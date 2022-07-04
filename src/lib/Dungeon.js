/**
 * @class The AutomationDungeon regroups the 'Dungeon AutoFight' functionalities
 */
class AutomationDungeon
{
    static Settings = {
                          FeatureEnabled: "Dungeon-FightEnabled",
                          StopOnPokedex: "Dungeon-FightStopOnPokedex",
                          BossRushEnabled: "Dungeon-FightBossRushEnabled",
                          DontOpenChests: "Dungeon-FightDontOpenChests"
                      };

    static InternalModes = {
                              None: 0,
                              StopAfterThisRun: 1,
                              ByPassUserSettings: 2
                          };

    static AutomationRequestedMode = this.InternalModes.None;

    /**
     * @brief Builds the menu
     *
     * @param initStep: The current automation init step
     */
    static initialize(initStep)
    {
        // Only consider the BuildMenu init step
        if (initStep === Automation.InitSteps.BuildMenu) {
            this.__internal__injectDungeonCss();

        // Hide the gym and dungeon fight menus by default and disable auto fight
        let dungeonTitle = '<img src="assets/images/trainers/Crush Kin.png" height="20px" style="transform: scaleX(-1); position:relative; bottom: 3px;">'
                         +     '&nbsp;Dungeon fight&nbsp;'
                         + '<img src="assets/images/trainers/Crush Kin.png" style="position:relative; bottom: 3px;" height="20px">';
        let dungeonDiv = Automation.Menu.addCategory("dungeonFightButtons", dungeonTitle);
        dungeonDiv.parentElement.hidden = true;

        // Add an on/off button
        let autoDungeonTooltip = "Automatically enters and completes the dungeon"
                               + Automation.Menu.TooltipSeparator
                               + "Chests and the boss are ignored until all tiles are revealed\n"
                               + "Chests are all picked right before fighting the boss";
        let autoDungeonButton = Automation.Menu.addAutomationButton("AutoFight", this.Settings.FeatureEnabled, autoDungeonTooltip, dungeonDiv, true);
        autoDungeonButton.addEventListener("click", this.__internal__toggleDungeonFight.bind(this), false);

        // Disable by default
        Automation.Menu.forceAutomationState(this.Settings.FeatureEnabled, false);

        // Add an on/off button to stop after pokedex completion
        let autoStopDungeonTooltip = "Automatically disables the dungeon loop\n"
                                   + "once all pokemon are caught in this dungeon."
                                   + Automation.Menu.TooltipSeparator
                                   + "You can switch between pokemon and shiny completion\n"
                                   + "by clicking on the pokeball image.";

        let buttonLabel = 'Stop on <span id="automation-dungeon-pokedex-img"><img src="assets/images/pokeball/Pokeball.svg" height="17px"></span> :';
        Automation.Menu.addAutomationButton(buttonLabel, this.Settings.StopOnPokedex, autoStopDungeonTooltip, dungeonDiv);

        // Add the button action
        let pokedexSwitch = document.getElementById("automation-dungeon-pokedex-img");
        pokedexSwitch.onclick = this.__internal__toggleCatchStopMode.bind(this);

            let bossRushButton = Automation.Menu.addAutomationButton("Immediately Fight Boss", this.Settings.BossRushEnabled, undefined, dungeonDiv);
            bossRushButton.addEventListener("click", this.__internal__toggleBossRush.bind(this), false);
            Automation.Utils.LocalStorage.setDefaultValue(this.Settings.BossRushEnabled, false)

            let dontOpenChestsButton = Automation.Menu.addAutomationButton("Ignore Chests", this.Settings.DontOpenChests, undefined, dungeonDiv);
            dontOpenChestsButton.addEventListener("click", this.__internal__toggleDontOpenChests.bind(this), false);
            Automation.Utils.LocalStorage.setDefaultValue(this.Settings.DontOpenChests, false)

            // Set the div visibility watcher
            setInterval(this.__internal__updateDivVisibilityAndContent.bind(this), 200); // Refresh every 0.2s
        }
        else if (initStep === Automation.InitSteps.Finalize)
        {
            // Restore previous session state
            this.__internal__toggleBossRush();
            this.__internal__toggleDontOpenChests();
        }
    }

    /*********************************************************************\
    |***    Internal members, should never be used by other classes    ***|
    \*********************************************************************/

    static __internal__autoDungeonLoop = null;

    static __internal__isShinyCatchStopMode = false;
    static __internal__isBossRushMode = false;
    static __internal__dontOpenChests = false;

    /**
     * @brief Injects the Dungeon menu css to the document heading
     */
    static __internal__injectDungeonCss()
    {
        const style = document.createElement('style');
        style.textContent = `#automation-dungeon-pokedex-img
                             {
                                 position:relative;
                                 cursor: pointer;
                             }
                             #automation-dungeon-pokedex-img::after, #automation-dungeon-pokedex-img::before
                             {
                                 display: inline-block;
                                 width: 17px;
                                 height: 17px;
                                 position: absolute;
                                 left: 0px;
                                 bottom: 0px;
                                 border-radius: 50%;
                                 border-width: 0px;
                                 content: '';
                                 opacity: 0%;
                             }
                             #automation-dungeon-pokedex-img::before
                             {
                                 background-color: transparent;
                             }
                             #automation-dungeon-pokedex-img::after
                             {
                                 background-color: #ccccff;
                             }
                             #automation-dungeon-pokedex-img:hover::before
                             {
                                 opacity: 100%;
                                 box-shadow: 0px 0px 2px 1px #178fd7;
                             }
                             #automation-dungeon-pokedex-img:hover::after
                             {
                                 opacity: 20%;
                             }`;
        document.head.append(style);
    }

    /**
     * @brief Switched from Pokedex completion to Shiny pokedex completion mode
     */
    static __internal__toggleCatchStopMode()
    {
        // Switch mode
        this.__internal__isShinyCatchStopMode = !this.__internal__isShinyCatchStopMode;

        // Update the image accordingly
        let image = (this.__internal__isShinyCatchStopMode) ? "Pokeball-shiny" : "Pokeball";
        let pokedexSwitch = document.getElementById("automation-dungeon-pokedex-img");
        pokedexSwitch.innerHTML = `<img src="assets/images/pokeball/${image}.svg" height="17px">`;
    }

    /**
     * @brief Toggles the 'Dungeon AutoFight' feature
     *
     * If the feature was enabled and it's toggled to disabled, the loop will be stopped.
     * If the feature was disabled and it's toggled to enabled, the loop will be started.
     *
     * @param enable: [Optional] If a boolean is passed, it will be used to set the right state.
     *                Otherwise, the cookie stored value will be used
     */
    static __internal__toggleDungeonFight(enable)
    {
        // If we got the click event, use the button status
        if ((enable !== true) && (enable !== false))
        {
            enable = (Automation.Utils.LocalStorage.getValue(this.Settings.FeatureEnabled) === "true");
        }

        if (enable)
        {
            // Only set a loop if there is none active
            if (this.__internal__autoDungeonLoop === null)
            {
                // Set auto-dungeon loop
                this.__internal__autoDungeonLoop = setInterval(this.__internal__dungeonFightLoop.bind(this), 50); // Runs every game tick
            }
        }
        else
        {
            // Unregister the loop
            clearInterval(this.__internal__autoDungeonLoop);
            this.__internal__autoDungeonLoop = null;
        }
    }

    /**
     * @brief Toggles the 'Immediately Fight Boss' mode
     */
    static __internal__toggleBossRush()
    {
        this.__internal__isBossRushMode = (Automation.Utils.LocalStorage.getValue(this.Settings.BossRushEnabled) === "true");
    }

    /**
     * @brief Toggles the 'Ignore Chests' mode
     */
    static __internal__toggleDontOpenChests()
    {
        this.__internal__dontOpenChests = (Automation.Utils.LocalStorage.getValue(this.Settings.DontOpenChests) === "true");
    }

    /**
     * @brief Get Visitable Tiles
     *
     * Returns a list of all visitable tiles
     *
     * @param type: [Optional] If a `GameConstants.DungeonTile` is passed, results will be filtered to only that type.
     *              This will only return visible tiles.
     *
     * @param unvisited: [Optional] If a Boolean is passed, results will be filtered to only unvisited tiles
     */
    static __internal__getVisitableTiles(type, unvisited)
    {
        let visitableTiles = []
        DungeonRunner.map.board().forEach(
            (row, rowIndex) =>
            {
                row.forEach(
                    (tile, columnIndex) =>
                    {
                        if (DungeonRunner.map.hasAccesToTile({ x: columnIndex, y: rowIndex })
                            && (type? (tile.type === type && tile.isVisible) : true)
                            && (unvisited? !tile.isVisited : true ))
                        {
                            visitableTiles.push(
                                {
                                    tile,
                                    visit: () => {DungeonRunner.map.moveToCoordinates({ x: columnIndex, y: rowIndex });}
                                })
                        }
                    })
            })
        return visitableTiles;
    }

    /**
     * @brief The Dungeon AutoFight loop
     *
     * It will automatically start the current dungeon.
     * Once started, it will automatically complete the dungeon, fighting every encounters in it.
     * Once every tiles are done exploring, all chests are collected.
     * Finally, the boss is defeated last.
     *
     * The chest are picked at the very end, right before fighting the boss to avoid losing time.
     * Indeed, picking a chest increases every upcoming encounter's life.
     */
    static __internal__dungeonFightLoop()
    {
        // Only initialize dungeon if:
        //    - The player is in a town (dungeons are attached to town)
        //    - The player has bought the dungeon ticket
        //    - The player has enough dungeon token
        if (App.game.gameState === GameConstants.GameState.town
            && (player.town() instanceof DungeonTown)
            && App.game.keyItems.hasKeyItem(KeyItemType.Dungeon_ticket)
            && (App.game.wallet.currencies[GameConstants.Currency.dungeonToken]() >= player.town().dungeon.tokenCost))
        {
            // Reset button status if either:
            //    - it was requested by another module
            //    - the pokedex is full for this dungeon, and it has been ask for
            if ((this.AutomationRequestedMode != this.InternalModes.ByPassUserSettings)
                && ((this.AutomationRequestedMode == this.InternalModes.StopAfterThisRun)
                    || ((Automation.Utils.LocalStorage.getValue(this.Settings.StopOnPokedex) === "true")
                        && DungeonRunner.dungeonCompleted(player.town().dungeon, this.__internal__isShinyCatchStopMode))))
            {

                Automation.Menu.forceAutomationState(this.Settings.FeatureEnabled, false);
                this.AutomationRequestedMode = this.InternalModes.None;
            }
            else
            {
                DungeonRunner.initializeDungeon(player.town().dungeon);
            }
        }
        else if (App.game.gameState === GameConstants.GameState.dungeon)
        {
            // Let any fight or catch finish before moving
            if (DungeonRunner.fightingBoss() || DungeonRunner.fighting() || DungeonBattle.catching())
            {
                return;
            }

            // visit all known empty tiles on the map
            let emptyTiles = this.__internal__getVisitableTiles(GameConstants.DungeonTile.empty, true)
            while (emptyTiles.length > 0)
            {
                emptyTiles.forEach((tile) => {
                    tile.visit()
                })
                emptyTiles = this.__internal__getVisitableTiles(GameConstants.DungeonTile.empty, true)
            }

            let bossTiles = this.__internal__getVisitableTiles(GameConstants.DungeonTile.boss)
            if (this.__internal__isBossRushMode && bossTiles.length > 0)
            {
                bossTiles[0].visit();
                DungeonRunner.startBossFight();
                return;
            }

            let tiles = this.__internal__getVisitableTiles(undefined, true);
            if (tiles.length > 0)
            {
                tiles[0].visit();
            }
            else
            {
                // we have explored the entire dungeon
                if (!this.__internal__dontOpenChests) {
                    let chestTiles = this.__internal__getVisitableTiles(GameConstants.DungeonTile.chest);
                    chestTiles.forEach((tile) => {
                        tile.visit();
                        DungeonRunner.openChest();
                        // it's not a problem if we get an encounter, the game will simply not move us to the next one,
                        // and we will visit it on the next loop
                    })
                }
                this.__internal__getVisitableTiles(GameConstants.DungeonTile.boss)[0].visit();
                DungeonRunner.startBossFight();
            }
        }
        // Else hide the menu and turn off the feature, if we're not in the dungeon anymore
        else
        {
            Automation.Menu.forceAutomationState(this.Settings.FeatureEnabled, false);
        }
    }

    /**
     * @brief Toggle the 'Dungeon fight' category visibility based on the game state
     *        Disables the 'AutoFight' button if the feature can't be used
     *
     * The category is only visible when a dungeon is actually available at the current position
     * (or if the player is already inside the dungeon)
     *
     * The 'AutoFight' button is disabled in the following cases:
     *   - The player did not buy the Dungeon ticket yet
     *   - The user enabled 'Stop on Pokedex' and all pokemon in the dungeon are already caught
     *   - The player does not have enough dungeon token to enter
     */
    static __internal__updateDivVisibilityAndContent()
    {
        let dungeonDiv = document.getElementById("dungeonFightButtons");
        dungeonDiv.hidden = !((App.game.gameState === GameConstants.GameState.dungeon)
                              || ((App.game.gameState === GameConstants.GameState.town)
                                  && (player.town() instanceof DungeonTown)));

        // Don't disable the button if the player is still in the dungeon
        if (!dungeonDiv.hidden
            && (App.game.gameState !== GameConstants.GameState.dungeon))
        {
            // Disable the AutoFight button if the requirements are not met
            let disableNeeded = false;
            let disableReason = "";

            // The player might not have bought the dungeon ticket yet
            if (!App.game.keyItems.hasKeyItem(KeyItemType.Dungeon_ticket))
            {
                disableNeeded = true;
                disableReason = "You need to buy the Dungeon Ticket first";
            }

            // The 'stop on pokedex' feature might be enable and the pokedex already completed
            if ((this.AutomationRequestedMode != this.InternalModes.ByPassUserSettings)
                && (Automation.Utils.LocalStorage.getValue(this.Settings.StopOnPokedex) == "true")
                && DungeonRunner.dungeonCompleted(player.town().dungeon, this.__internal__isShinyCatchStopMode))
            {
                disableNeeded = true;
                disableReason += (disableReason !== "") ? "\nAnd all " : "All ";

                if (this.__internal__isShinyCatchStopMode)
                {
                    disableReason += "shiny ";
                }

                disableReason += "pokemons are already caught,\nand the option to stop in this case is enabled";
            }

            // The player does not have enough dugeon token
            if (App.game.wallet.currencies[GameConstants.Currency.dungeonToken]() < player.town().dungeon.tokenCost)
            {
                disableNeeded = true;

                disableReason += (disableReason !== "") ? "\nAnd you " : "You ";
                disableReason += "do not have enough Dungeon Token to enter";
            }

            if (disableNeeded)
            {
                Automation.Menu.setButtonDisabledState(this.Settings.FeatureEnabled, true, disableReason);
            }
            else
            {
                Automation.Menu.setButtonDisabledState(this.Settings.FeatureEnabled, false);
            }
        }
    }
}
