/**
 * @class The AutomationUtils regroups any utility methods needed across the different functionalities
 */
class AutomationUtils
{
    /**
     * @brief Initializes the Utils components
     */
    static init()
    {
        this.Route.init();
    }

    /**
     * @class The Route inner-class
     */
    static Route = class AutomationRouteUils
    {
        // Map of Map [ region => [ route => maxHp ]]
        static __routeMaxHealthMap = new Map();

        static __lastHighestRegion = null;
        static __lastBestRouteRegion = null;
        static __lastBestRoute = null;
        static __lastNextBestRoute = null;
        static __lastNextBestRouteRegion = null;

        /**
         * @brief Initializes the class members
         */
        static init()
        {
            this.__buildRouteMaxHealthMap();
        }

        /**
         * @brief Moves the player to the given @p route, in the @p region
         *
         * @param route: The number of the route to move to
         * @param region: The region number of the route to move to
         *
         * @note If the @p route or @p region have not been unlocked, no move will happen
         */
        static __moveToRoute(route, region)
        {
            // Don't move if the game would not allow it
            if (!this.__canMoveToRegion(region)
                || !MapHelper.accessToRoute(route, region))
            {
                return;
            }

            MapHelper.moveToRoute(route, region);
        }

        /**
         * @brief Moves the player to the town named @p townName
         *
         * @param townName: The name of the town to move to
         *
         * @note If the given town was not unlocked, no move will happen
         */
        static __moveToTown(townName)
        {
            let town = TownList[townName];

            // Don't move if the game would not allow it
            if (!this.__canMoveToRegion(town.region)
                || !town.isUnlocked())
            {
                return;
            }

            // Move the player to the region first, if needed
            if (town.region != player.town().region)
            {
                MapHelper.moveToTown(GameConstants.DockTowns[town.region]);
                player.region = town.region;
                player._subregion(0);
            }

            MapHelper.moveToTown(townName);
        }

        /**
         * @brief Checks if the player is allowed to move to the given @p region
         *
         * @param region: The region number to move to
         *
         * @returns True if the player can mov to the region, False otherwise
         */
        static __canMoveToRegion(region)
        {
            // Not possible move
            if (Automation.Utils.__isInInstanceState()
                || (region > player.highestRegion())
                || (region < 0))
            {
                return false;
            }

            // Highest region restricts the inter-region moves until the docks are unlocked
            if ((player.region === player.highestRegion())
                && (region !== player.region))
            {
                return TownList[GameConstants.DockTowns[player.region]].isUnlocked();
            }

            return true;
        }

        /**
         * @brief Moves to the best available route for pokemon Exp farming
         *
         * The best route is the highest unlocked route where any pokemon can be defeated in a single click attack
         */
        static __moveToBestRouteForExp()
        {
            // Disable best route if any instance is in progress, and exit
            if (Automation.Utils.__isInInstanceState())
            {
                return;
            }

            let playerClickAttack = App.game.party.calculateClickAttack();

            // We need to find a new road if:
            //    - The highest region changed
            //    - The player attack decreased (this can happen if the poison bard item was unequiped)
            //    - We are currently on the highest route of the map
            //    - The next best route is still over-powered
            let needsNewRoad = (this.__lastHighestRegion !== player.highestRegion())
                            || (this.__routeMaxHealthMap.get(this.__lastBestRouteRegion).get(this.__lastBestRoute) > playerClickAttack)
                            || ((this.__lastNextBestRoute !== this.__lastBestRoute)
                                && (this.__routeMaxHealthMap.get(this.__lastNextBestRouteRegion).get(this.__lastNextBestRoute) < playerClickAttack));

            // Don't refresh if we already are on the best road
            if ((this.__lastBestRoute === player.route()) && !needsNewRoad)
            {
                return;
            }

            if (needsNewRoad)
            {
                this.__lastHighestRegion = player.highestRegion();

                // If no routes are below the user attack, just choose the 1st one
                this.__lastBestRoute = 0;
                this.__lastBestRouteRegion = 0;
                this.__lastNextBestRoute = 0;
                this.__lastNextBestRouteRegion = 0;

                // Fortunately routes are sorted by region and by attack
                Routes.regionRoutes.every(
                    (route) =>
                    {
                        // Skip any route that we can't access
                        if (!Automation.Utils.Route.__canMoveToRegion(route.region))
                        {
                            return true;
                        }

                        if (this.__routeMaxHealthMap.get(route.region).get(route.number) < playerClickAttack)
                        {
                            this.__lastBestRoute = route.number;
                            this.__lastBestRouteRegion = route.region;

                            return true;
                        }

                        this.__lastNextBestRoute = route.number;
                        this.__lastNextBestRouteRegion = route.region;
                        return false;
                    }, this);

                // This can happen if the player is in a new region and the docks are not unlocked yet
                if (this.__lastBestRoute == 0)
                {
                    let regionRoutes = Routes.getRoutesByRegion(player.region);
                    this.__lastBestRoute = regionRoutes[0].number;
                    this.__lastBestRouteRegion = regionRoutes[0].region;
                    this.__lastNextBestRoute = regionRoutes[1].number;
                    this.__lastNextBestRouteRegion = regionRoutes[1].region;
                }
            }

            this.__moveToRoute(this.__lastBestRoute, this.__lastBestRouteRegion);
        }

        /**
         * @brief Gets the highest HP amount that a pokemon can have on the given @p route
         *
         * @param route: The pokeclicker RegionRoute object
         *
         * @returns The computed route max HP
         */
        static __getRouteMaxHealth(route)
        {
            let routeMaxHealth = 0;
            RouteHelper.getAvailablePokemonList(route.number, route.region).forEach(
                (pokemonName) =>
                {
                    routeMaxHealth = Math.max(routeMaxHealth, this.__getPokemonMaxHealth(route, pokemonName));
                }, this);

            return routeMaxHealth;
        }

        /**
         * @brief Gets the given @p pokemonName total HP on the given @p route
         *
         * @param route: The pokeclicker RegionRoute object
         * @param pokemonName: The name of the pokemon to compute the total HP of
         *
         * @returns The computed pokemon max HP
         */
        static __getPokemonMaxHealth(route, pokemonName)
        {
            // Based on https://github.com/pokeclicker/pokeclicker/blob/b5807ae2b8b14431e267d90563ae8944272e1679/src/scripts/pokemons/PokemonFactory.ts#L33
            let basePokemon = PokemonHelper.getPokemonByName(pokemonName);

            let getRouteAverageHp = function()
            {
                let poke = [...new Set(Object.values(Routes.getRoute(route.region, route.number).pokemon).flat().map(p => p.pokemon ?? p).flat())];
                let total = poke.map(p => pokemonMap[p].base.hitpoints).reduce((s, a) => s + a, 0);
                return total / poke.length;
            };

            let routeAvgHp = getRouteAverageHp();
            let routeHp = PokemonFactory.routeHealth(route.number, route.region);

            return Math.round((routeHp - (routeHp / 10)) + (routeHp / 10 / routeAvgHp * basePokemon.hitpoints));
        }

        /**
         * @brief Builds the [ region => [ route => maxHp ]] map of map for each existing routes
         *
         * The resulting map is stored as a member of this class @c __routeMaxHealthMap for further use
         */
        static __buildRouteMaxHealthMap()
        {
            Routes.regionRoutes.forEach(
                (route) =>
                {
                    if (route.region >= this.__routeMaxHealthMap.size)
                    {
                        this.__routeMaxHealthMap.set(route.region, new Map());
                    }

                    let routeMaxHealth = this.__getRouteMaxHealth(route);
                    this.__routeMaxHealthMap.get(route.region).set(route.number, routeMaxHealth);
                }, this);
        }
    }

    /**
     * @brief Adds a pokeclicker notification using the given @p message
     *        The notification is a blue one, without sound and with the "Automation" ttitle
     *
     * @param message: The notification message
     */
    static __sendNotif(message)
    {
        if (localStorage.getItem("automationNotificationsEnabled") == "true")
        {
            Notifier.notify({
                                title: "Automation",
                                message: message,
                                type: NotificationConstants.NotificationOption.primary,
                                timeout: 3000,
                            });
        }
    }

    /**
     * @brief Checks if the player is in an instance states
     *
     * Is considered an instance any state in which the player can't acces the map anymore.
     * The following states are considered:
     *   - Dungeon
     *   - Battle frontier
     *   - Temporary battle
     *   - Safari
     *
     * Some actions are not allowed in instance states, like moving to another location.
     *
     * @returns True if the player is in an instance, False otherwise
     */
    static __isInInstanceState()
    {
        return (App.game.gameState === GameConstants.GameState.dungeon)
            || (App.game.gameState === GameConstants.GameState.battleFrontier)
            || (App.game.gameState === GameConstants.GameState.temporaryBattle)
            || (App.game.gameState === GameConstants.GameState.safari);
    }

    /**
     * @brief Checks if two arrays are equals
     *
     * Arrays are equals if:
     *   - They both are arrays
     *   - Their length is the same
     *   - Their content is the same and at the same index
     *
     * @param a: The first array
     * @param b: The second array
     *
     * @returns True if the arrays are equals, False otherwise
     */
    static __areArrayEquals(a, b)
    {
        return Array.isArray(a)
            && Array.isArray(b)
            && (a.length === b.length)
            && a.every((val, index) => val === b[index]);
    }
}