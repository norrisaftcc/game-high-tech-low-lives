/*
 * NARRATIVE GAME ENGINE - Teaching Example
 * High Tech, Low Lives - C++ Prototype
 *
 * PURPOSE: This program demonstrates how to use functions and data structures
 * to manage complexity in a text-based narrative game.
 *
 * KEY LEARNING CONCEPTS:
 * 1. Using structs to organize related data
 * 2. Breaking complex logic into focused functions
 * 3. Managing game state through a central data structure
 * 4. Using const for read-only data
 * 5. Pass-by-reference to avoid unnecessary copying
 */

#include <iostream>
#include <string>
#include <vector>
#include <limits>  // For input validation

using namespace std;

// ============================================================================
// DATA STRUCTURES
// ============================================================================
// We use structs to group related data together. This makes our code more
// organized and easier to understand.

/**
 * Choice represents a single option the player can select.
 *
 * DESIGN NOTE: Keeping data simple and focused. Each struct should represent
 * one clear concept.
 */
struct Choice {
    string text;           // What the player sees
    string nextSceneId;    // Where this choice leads
};

/**
 * Scene represents one moment in the story with its available choices.
 *
 * DESIGN NOTE: Using vectors for dynamic-sized lists. The vector will
 * automatically manage memory for us.
 */
struct Scene {
    string id;                  // Unique identifier
    string title;               // Scene title
    vector<string> narrative;   // Lines of story text
    vector<Choice> choices;     // Available player choices
};

/**
 * GameState tracks everything about the current game session.
 *
 * DESIGN NOTE: Centralizing state in one place makes it easier to manage
 * and pass between functions. As the game grows, you'd add more fields here.
 *
 * TEACHING NOTE: The stress values are constrained to 0-3. We provide helper
 * methods to ensure values stay within valid range, demonstrating data validation.
 */
struct GameState {
    string currentSceneId;      // Which scene we're in
    string enforcerName;        // Customizable character name
    int stressMeat;            // Physical condition (0-3)
    int stressNerves;          // Mental condition (0-3)
    int stressSystems;         // Cyberware condition (0-3)

    // Constructor: Initialize with default values
    GameState() : currentSceneId("intro"),
                  enforcerName("NOMAD-7"),
                  stressMeat(3),
                  stressNerves(3),
                  stressSystems(3) {}

    /**
     * Clamp a value to the valid stress range (0-3).
     *
     * TEACHING NOTE: This is a helper function that ensures values stay in bounds.
     * Using a helper like this prevents invalid state throughout the program.
     */
    static int clampStress(int value) {
        if (value < 0) return 0;
        if (value > 3) return 3;
        return value;
    }

    /**
     * Set stress values with automatic clamping to valid range.
     *
     * TEACHING NOTE: These setters demonstrate how to validate data when it's modified.
     * This is better than allowing direct assignment, which could create invalid state.
     */
    void setStressMeat(int value) { stressMeat = clampStress(value); }
    void setStressNerves(int value) { stressNerves = clampStress(value); }
    void setStressSystems(int value) { stressSystems = clampStress(value); }
};

// ============================================================================
// FUNCTION DECLARATIONS
// ============================================================================
// Declaring functions at the top helps organize code and allows functions
// to call each other regardless of their order in the file.

// Display functions - responsible for showing information to the player
void printHeader();
void printDivider(char symbol = '-', int length = 60);
void printStatus(const GameState& state);
void printNarrative(const vector<string>& lines);
void printChoices(const vector<Choice>& choices);

// Game logic functions - handle the core game mechanics
int getPlayerChoice(int maxChoice);
Scene* findScene(const string& sceneId, vector<Scene>& allScenes);
void runScene(Scene& scene, GameState& state, vector<Scene>& allScenes);

// Data setup function - initialize all game content
vector<Scene> createStoryScenes();

// ============================================================================
// MAIN FUNCTION
// ============================================================================
// The main function is kept simple and readable by delegating work to
// other functions. This is a key principle: main() should read like a
// high-level outline of what the program does.

int main() {
    cout << "\n=== High Tech, Low Lives - C++ Prototype ===\n\n";

    // Initialize game state and story data
    GameState gameState;
    vector<Scene> allScenes = createStoryScenes();

    printHeader();

    // Main game loop - continues until player reaches an ending
    // DESIGN NOTE: The loop condition checks if we can find the next scene.
    // When findScene returns nullptr, we've reached an ending.
    while (Scene* currentScene = findScene(gameState.currentSceneId, allScenes)) {
        runScene(*currentScene, gameState, allScenes);
    }

    cout << "\n=== END OF PROTOTYPE ===\n";
    cout << "Thank you for testing the narrative engine!\n\n";

    return 0;
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================
// These functions handle all output to the player. By separating display
// logic from game logic, we make both easier to modify and test.

/**
 * Print the game header/title screen.
 *
 * TEACHING NOTE: Simple functions like this might seem unnecessary, but they
 * make the main() function more readable and allow you to easily change the
 * header format in one place.
 */
void printHeader() {
    printDivider('=', 60);
    cout << "   DECK INTERFACE v2.0 - Neural Bridge System\n";
    cout << "   You are the HANDLER guiding an Enforcer through the field\n";
    printDivider('=', 60);
    cout << "\n";
}

/**
 * Print a divider line.
 *
 * @param symbol Character to use for the line
 * @param length How many characters long
 *
 * TEACHING NOTE: Default parameters (char symbol = '-') let you call this
 * function with just printDivider() or customize it with printDivider('*', 40)
 */
void printDivider(char symbol, int length) {
    cout << string(length, symbol) << "\n";
}

/**
 * Display the current game state (enforcer status).
 *
 * @param state The game state to display (const reference - we only read it)
 *
 * TEACHING NOTE: We use const& to avoid copying the entire GameState and to
 * signal that this function only reads data, never modifies it.
 */
void printStatus(const GameState& state) {
    cout << "\n--- ENFORCER STATUS ---\n";
    cout << "Agent: " << state.enforcerName << "\n";
    cout << "Meat:    " << string(state.stressMeat, '#')
         << string(3 - state.stressMeat, '-') << " ("
         << state.stressMeat << "/3)\n";
    cout << "Nerves:  " << string(state.stressNerves, '#')
         << string(3 - state.stressNerves, '-') << " ("
         << state.stressNerves << "/3)\n";
    cout << "Systems: " << string(state.stressSystems, '#')
         << string(3 - state.stressSystems, '-') << " ("
         << state.stressSystems << "/3)\n";
    printDivider('-', 60);
}

/**
 * Display narrative text line by line.
 *
 * @param lines Vector of text lines to display
 *
 * TEACHING NOTE: Using a vector of strings allows scenes to have different
 * amounts of text without needing a fixed-size array.
 */
void printNarrative(const vector<string>& lines) {
    cout << "\n";
    for (const string& line : lines) {
        cout << line << "\n";
    }
    cout << "\n";
}

/**
 * Display available choices to the player.
 *
 * @param choices Vector of Choice objects to display
 *
 * TEACHING NOTE: We number choices starting at 1 for the player (more natural)
 * but remember that vector indices start at 0 (handled in getPlayerChoice).
 */
void printChoices(const vector<Choice>& choices) {
    cout << "--- AVAILABLE ACTIONS ---\n";
    for (size_t i = 0; i < choices.size(); ++i) {
        cout << "[" << (i + 1) << "] " << choices[i].text << "\n";
    }
    cout << "\n";
}

// ============================================================================
// GAME LOGIC FUNCTIONS
// ============================================================================
// These functions handle the mechanics of running the game.

/**
 * Get a valid choice from the player.
 *
 * @param maxChoice Highest valid choice number
 * @return Zero-based index of the chosen option
 *
 * TEACHING NOTE: Input validation is crucial! This function keeps asking
 * until it gets valid input. Notice how we clear the error state and ignore
 * bad input from cin.
 */
int getPlayerChoice(int maxChoice) {
    int choice;
    while (true) {
        cout << "Your choice: ";
        cin >> choice;

        // Check if input was valid and in range
        if (cin.fail()) {
            // Clear error state
            cin.clear();
            // Ignore rest of line
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            cout << "Invalid input. Please enter a number.\n";
            continue;
        }

        // Validate range (remember: player sees 1-N, we need 0-(N-1))
        if (choice >= 1 && choice <= maxChoice) {
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            return choice - 1;  // Convert to 0-based index
        }

        cout << "Please choose between 1 and " << maxChoice << ".\n";
    }
}

/**
 * Find a scene by its ID.
 *
 * @param sceneId The ID to search for
 * @param allScenes Vector containing all scenes
 * @return Pointer to the found scene, or nullptr if not found
 *
 * TEACHING NOTE: Returning a pointer lets us signal "not found" with nullptr.
 * In modern C++, you might use std::optional<Scene> instead, but pointers
 * are simpler for learning.
 */
Scene* findScene(const string& sceneId, vector<Scene>& allScenes) {
    for (Scene& scene : allScenes) {
        if (scene.id == sceneId) {
            return &scene;
        }
    }
    return nullptr;  // Not found
}

/**
 * Run a single scene: display it, get player choice, update state.
 *
 * @param scene The scene to run (reference - we're working with the actual scene)
 * @param state Game state (reference - we'll modify it based on choices)
 * @param allScenes All scenes (needed to validate transitions)
 *
 * TEACHING NOTE: This is the heart of the game loop. Notice how it delegates
 * specific tasks to other functions, keeping this function focused on the
 * high-level flow: show -> choose -> update.
 */
void runScene(Scene& scene, GameState& state, vector<Scene>& allScenes) {
    // Display scene information
    cout << "\n";
    printDivider('=', 60);
    cout << "Scene: " << scene.title << "\n";
    printDivider('=', 60);

    printStatus(state);
    printNarrative(scene.narrative);

    // If no choices, this is an ending scene
    if (scene.choices.empty()) {
        cout << "[End of scene - no further choices]\n";
        state.currentSceneId = "";  // Signal game over
        return;
    }

    // Get and process player choice
    printChoices(scene.choices);
    int choiceIndex = getPlayerChoice(scene.choices.size());

    // Update game state based on choice
    const Choice& selectedChoice = scene.choices[choiceIndex];
    cout << "\n>> You chose: " << selectedChoice.text << "\n";

    // Move to next scene
    state.currentSceneId = selectedChoice.nextSceneId;

    // EXTENSION OPPORTUNITY: Here you could add code to modify stress levels,
    // set flags, add items, etc. based on the choice made.
}

// ============================================================================
// STORY CONTENT
// ============================================================================
// This function creates all the scenes in the game. In a larger project,
// you'd load this from a file, but hardcoding it here keeps the example simple.

/**
 * Create and return all story scenes.
 *
 * TEACHING NOTE: This function is long because it contains all the content,
 * but its structure is very repetitive. Each scene follows the same pattern:
 * create scene, set id/title, add narrative, add choices, add to vector.
 *
 * In a real game, you'd want to load this from a data file (JSON, XML, etc.)
 * so writers can edit the story without touching code.
 */
vector<Scene> createStoryScenes() {
    vector<Scene> scenes;

    // ---- Scene 1: Introduction ----
    Scene intro;
    intro.id = "intro";
    intro.title = "First Contact";
    intro.narrative = {
        ">> INCOMING TRANSMISSION [NOMAD-7]",
        "",
        "Handler, this is Nomad-7. I'm in position outside the target.",
        "Rain's coming down hard. Visibility is poor. I've got eyes on",
        "three guards at the main entrance, two patrol boats circling.",
        "Corporate security, recent chrome. They're expecting trouble.",
        "",
        "What's your call, Handler?"
    };

    intro.choices = {
        {"Ask about approach preference", "approach"},
        {"Scan their chrome for threat assessment", "scan"},
        {"Pull building schematics", "schematics"}
    };

    scenes.push_back(intro);

    // ---- Scene 2: Approach Discussion ----
    Scene approach;
    approach.id = "approach";
    approach.title = "Planning the Approach";
    approach.narrative = {
        ">> INCOMING TRANSMISSION [NOMAD-7]",
        "",
        "Depends on what you're seeing from your end, Handler.",
        "I can go loud - my mantis blades are sharp and these corpo",
        "types usually fold fast. Or I can try the maintenance access",
        "on the east side. Slower, but quieter.",
        "",
        "Your call."
    };

    approach.choices = {
        {"\"Go loud. Take them by surprise.\"", "mission_start"},
        {"\"Use maintenance access. Stay quiet.\"", "mission_start"},
        {"\"Wait. Let me scan the area first.\"", "scan"}
    };

    scenes.push_back(approach);

    // ---- Scene 3: Threat Scan ----
    Scene scan;
    scan.id = "scan";
    scan.title = "Threat Assessment";
    scan.narrative = {
        "[SYSTEM] Activating remote scanner...",
        "[SYSTEM] Scan complete - THREAT ANALYSIS:",
        "",
        "  >> GUARD-1: Subdermal armor (grade 2), shock baton",
        "  >> GUARD-2: Reflex boosters (military), SMG",
        "  >> GUARD-3: Pain editor, combat stims",
        "  >> ASSESSMENT: High threat. Coordinated response likely.",
        "",
        ">> INCOMING TRANSMISSION [NOMAD-7]",
        "",
        "Yeah, I'm reading those thermals too. Military-grade chrome.",
        "Someone's paying top credit for security tonight. This isn't",
        "your standard rent-a-cop setup. We walking into a trap?"
    };

    scan.choices = {
        {"\"Proceed with caution. Find alternate entry.\"", "schematics"},
        {"\"Your chrome is better. You can take them.\"", "mission_start"},
        {"\"Abort mission. Too risky.\"", "abort"}
    };

    scenes.push_back(scan);

    // ---- Scene 4: Building Schematics ----
    Scene schematics;
    schematics.id = "schematics";
    schematics.title = "Analyzing Blueprints";
    schematics.narrative = {
        "[SYSTEM] Accessing building database...",
        "[SYSTEM] Schematics retrieved - ANALYZING...",
        "",
        "  >> BUILDING: Tower 19-C, Corporate Sector",
        "  >> ACCESS POINTS: Main entrance, maintenance shaft (east)",
        "  >> SECURITY: Motion sensors (floors 1-3), camera grid",
        "  >> WEAKNESS: Maintenance shaft bypasses sensors",
        "",
        ">> INCOMING TRANSMISSION [NOMAD-7]",
        "",
        "Good catch, Handler. Maintenance shaft puts me behind their",
        "line. Gonna be tight and probably full of water, but I'll",
        "take wet and alive over loud and dead. Moving to position."
    };

    schematics.choices = {
        {"\"Copy that. Stay in contact.\"", "mission_start"},
        {"\"Wait. What's our extraction plan?\"", "mission_start"}
    };

    scenes.push_back(schematics);

    // ---- Scene 5: Mission Start ----
    Scene missionStart;
    missionStart.id = "mission_start";
    missionStart.title = "Moving In";
    missionStart.narrative = {
        "[SYSTEM] Enforcer moving to entry point...",
        "[SYSTEM] Connection stable. Monitoring vitals...",
        "",
        ">> INCOMING TRANSMISSION [NOMAD-7]",
        "",
        "Handler, I'm at the entry point. Before I go in...",
        "why are we doing this? You never said what we're",
        "extracting from Tower 19."
    };

    missionStart.choices = {
        {"\"Information. Corporate secrets.\"", "ending_professional"},
        {"\"A person. Someone who wants out.\"", "ending_compassion"},
        {"\"It's personal. I'll explain after.\"", "ending_trust"}
    };

    scenes.push_back(missionStart);

    // ---- Scene 6: Abort Mission ----
    Scene abort;
    abort.id = "abort";
    abort.title = "Mission Aborted";
    abort.narrative = {
        "[SYSTEM] TRANSMITTING ABORT COMMAND...",
        "",
        ">> INCOMING TRANSMISSION [NOMAD-7]",
        "",
        "Copy that, Handler. Good call. Live to fight another day.",
        "This job stunk from the start anyway. I'm pulling back.",
        "",
        "[SYSTEM] Enforcer retreating to safe distance...",
        "[SYSTEM] Mission status: ABORTED",
        "",
        "Sometimes knowing when NOT to engage is the best skill."
    };

    abort.choices = {};  // No choices - this is an ending

    scenes.push_back(abort);

    // ---- Ending Scenes ----
    Scene endingPro;
    endingPro.id = "ending_professional";
    endingPro.title = "Professional Distance";
    endingPro.narrative = {
        ">> INCOMING TRANSMISSION [NOMAD-7]",
        "",
        "Right. Need-to-know basis. I get it. I'm just the muscle.",
        "Fine. Going in now. If I don't check in within fifteen,",
        "assume I'm compromised. Nomad-7 out.",
        "",
        "[SYSTEM] Connection status: TENSE",
        "[SYSTEM] Neural bridge signal degrading...",
        "",
        "=== END OF PROLOGUE ===",
        "The professional handler maintains distance, but at what cost?"
    };
    endingPro.choices = {};
    scenes.push_back(endingPro);

    Scene endingComp;
    endingComp.id = "ending_compassion";
    endingComp.title = "Human Connection";
    endingComp.narrative = {
        ">> INCOMING TRANSMISSION [NOMAD-7]",
        "",
        "An extraction. Okay. That I can work with. You know I've",
        "pulled people out before - it never goes clean. They panic,",
        "they freeze, they do stupid things. But if you trust this",
        "person... I'm in. Going dark. Nomad-7 out.",
        "",
        "[SYSTEM] Connection status: FOCUSED",
        "[SYSTEM] Neural bridge signal degrading...",
        "",
        "=== END OF PROLOGUE ===",
        "Compassion in a cyberpunk world - rare, but powerful."
    };
    endingComp.choices = {};
    scenes.push_back(endingComp);

    Scene endingTrust;
    endingTrust.id = "ending_trust";
    endingTrust.title = "Earned Trust";
    endingTrust.narrative = {
        ">> INCOMING TRANSMISSION [NOMAD-7]",
        "",
        "Personal. Shit. Those are always the worst kind of jobs,",
        "Handler. But you've kept me alive this long, so I trust you.",
        "I just hope whatever's in there is worth bleeding for.",
        "Going dark now. Nomad-7 out.",
        "",
        "[SYSTEM] Connection status: LOYAL",
        "[SYSTEM] Neural bridge signal degrading...",
        "",
        "=== END OF PROLOGUE ===",
        "Trust between handler and enforcer - the most valuable currency."
    };
    endingTrust.choices = {};
    scenes.push_back(endingTrust);

    return scenes;
}
