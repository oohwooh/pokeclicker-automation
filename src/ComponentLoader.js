/**
 * @class The automation loader abstraction class.
 *
 * This class contains a @c loadFromUrl function that is used by the userscript to load the module.
 * This is possible because pokeclicker is in the same origin as GitHub.
 * pokeclicker.com is probably only an alias on a github.io pages.
 */
class AutomationComponentLoader
{
    static __baseUrl = null;
    static __loadingList = [];
    static __loadingProgressTable = {};
    static __loadingOrder = 0;

    /**
     * @brief Loads the Automation classes from the given @p baseUrl
     *
     * @param {string} baseUrl: The base URL to download the lib component files from
     *
     * @warning This function should never change its prototype, otherwise it would break the API
     */
    static loadFromUrl(baseUrl)
    {
        this.__baseUrl = baseUrl;

        // From the least dependant, to the most dependent
        this.__addScript("src/lib/Focus/Achievements.js");
        this.__addScript("src/lib/Focus/Quests.js");
        this.__addScript("src/lib/Utils/LocalStorage.js");
        this.__addScript("src/lib/Utils/OakItem.js");
        this.__addScript("src/lib/Utils/Route.js");

        this.__loadingOrder += 1;
        this.__addScript("src/lib/Click.js");
        this.__addScript("src/lib/Dungeon.js");
        this.__addScript("src/lib/Farm.js");
        this.__addScript("src/lib/Focus.js");
        this.__addScript("src/lib/Gym.js");
        this.__addScript("src/lib/Hatchery.js");
        this.__addScript("src/lib/Items.js");
        this.__addScript("src/lib/Menu.js");
        this.__addScript("src/lib/Trivia.js");
        this.__addScript("src/lib/Underground.js");
        this.__addScript("src/lib/Utils.js");

        this.__loadingOrder += 1;
        this.__addScript("src/Automation.js");

        this.__setupAutomationRunner();
    }

    /**
     * @brief Adds the given @p fileRelativePath js file to the loading list
     *
     * @param {string} fileRelativePath: The file path relative to the @p __baseUrl
     */
    static __addScript(fileRelativePath)
    {
        this.__loadingList.push({ order: this.__loadingOrder, filePath: fileRelativePath });
    }

    /**
     * @brief Download the given @p fileRelativePath js file, and loads it into the page as a script component
     *
     * @param {string} fileRelativePath: The file path relative to the @p __baseUrl
     */
    static __loadScript(fileRelativePath)
    {
        let scriptName = this.__extractNameFromFile(fileRelativePath);
        this.__loadingProgressTable[scriptName] = false;

        // Github only serves plain-text so we can't load it as a script object directly
        let request = new XMLHttpRequest();
        request.onreadystatechange = function()
            {
                if ((request.readyState == 4) && (request.status == 200))
                {
                    // Store the content into a script div
                    var script = document.createElement('script');
                    script.innerHTML = request.responseText;
                    script.id = "pokeclicker-automation-" + scriptName;
                    document.head.appendChild(script);

                    this.__loadingProgressTable[scriptName] = true;
                }
            }.bind(this);

        // Download the content
        request.open("GET", this.__baseUrl + fileRelativePath, true);
        request.send();
    }

    /**
     * @brief Extracts the script name from the given @p filePath
     *
     * @param {string} filePath: The path to extract the script name from
     */
    static __extractNameFromFile(filePath)
    {
        let libPrefix = "src/lib/";
        if (filePath.startsWith(libPrefix))
        {
            let result = filePath.substring(libPrefix.length, filePath.length - 3);
            return result.replace("/", "-").toLowerCase();
        }
        return filePath.match(/^(.*\/)?([^/]+)\.js$/)[2].toLowerCase();
    }

    /**
     * @brief Sets a loading watcher.
     *        Once all scripts are properly loaded, the main class is loaded.
     *        Once done, it runs the automation.
     */
    static __setupAutomationRunner()
    {
        let currentLoadingOrder = -1;

        let watcher = setInterval(function ()
            {
                let isLoadingCompleted = Object.keys(this.__loadingProgressTable).every(key => this.__loadingProgressTable[key]);

                if (!isLoadingCompleted)
                {
                    return;
                }

                // Load the next batch (dependency requirement)
                if (currentLoadingOrder != this.__loadingOrder)
                {
                    currentLoadingOrder += 1;

                    this.__loadingList.forEach(
                        (scriptData) =>
                        {
                            if (scriptData.order === currentLoadingOrder)
                            {
                                this.__loadScript(scriptData.filePath);
                            }
                        });

                    return;
                }

                clearInterval(watcher);

                // Start the automation
                Automation.start();
            }.bind(this), 200); // Check every 200ms
    }
}