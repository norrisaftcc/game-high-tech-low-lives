# Tutorial: Learning from the Narrative Game Engine

This guide helps you understand the code step-by-step, starting from simple concepts and building up to complex ones.

## 🎯 Start Here: First-Time Reading

### Step 1: Understand the Goal (5 minutes)

Run the program first:
```bash
make run
```

Play through one complete path. This shows you WHAT the program does. Now let's understand HOW.

### Step 2: Look at the Data (10 minutes)

Open `narrative_game.cpp` and find the **Data Structures** section (lines 23-97).

Read these three structs in order:

1. **Choice** - Simplest structure
   ```cpp
   struct Choice {
       string text;           // What the player sees
       string nextSceneId;    // Where this choice leads
   };
   ```
   **Question**: If you wanted to add a "cost" to choices (using items), what field would you add?

2. **Scene** - Uses Choice
   ```cpp
   struct Scene {
       string id;
       string title;
       vector<string> narrative;
       vector<Choice> choices;
   };
   ```
   **Question**: Why is `narrative` a vector of strings instead of one big string?

3. **GameState** - The player's current situation
   ```cpp
   struct GameState {
       string currentSceneId;
       string enforcerName;
       int stressMeat;
       int stressNerves;
       int stressSystems;
   };
   ```
   **Question**: What would you add to track an inventory system?

### Step 3: Follow main() (10 minutes)

Find `main()` starting at line 127.

Notice how SHORT it is! This is good design.

```cpp
int main() {
    // 1. Initialize
    GameState gameState;
    vector<Scene> allScenes = createStoryScenes();

    printHeader();

    // 2. Main loop
    while (Scene* currentScene = findScene(gameState.currentSceneId, allScenes)) {
        runScene(*currentScene, gameState, allScenes);
    }

    // 3. Done
    cout << "\n=== END OF PROTOTYPE ===\n";
    return 0;
}
```

**Key Insight**: main() reads like English. "Initialize, print header, loop through scenes, finish." The DETAILS are hidden in other functions.

### Step 4: Trace One Function Call (15 minutes)

Let's trace what happens when we display the status:

1. `main()` calls → `runScene()`
2. `runScene()` calls → `printStatus(state)`
3. Look at `printStatus()`:

```cpp
void printStatus(const GameState& state) {
    cout << "\n--- ENFORCER STATUS ---\n";
    cout << "Agent: " << state.enforcerName << "\n";
    // ... more display code
}
```

**Notice**:
- `const GameState& state` - We pass by reference (efficient) and mark it const (safe)
- The function ONLY displays, doesn't modify anything
- One clear purpose: show the status

**Exercise**: Add a line to display the current scene ID. Where would you add it?

## 🔨 Hands-On Exercises

### Exercise 1: Modify Display (Easy)

Change how stress is displayed. Instead of `###--` show it as `3/5` or use different symbols.

**Where to look**: `printStatus()` function

**Hint**: Find this line:
```cpp
cout << "Meat:    " << string(state.stressMeat, '#')
```

### Exercise 2: Add a New Scene (Medium)

Add a new scene to the story:
1. Go to `createStoryScenes()` (line 358)
2. Copy the pattern from an existing scene
3. Create a Scene with:
   - A unique id (like "new_scene")
   - A title
   - Some narrative text
   - 2-3 choices

**Challenge**: Link your new scene from an existing choice!

### Exercise 3: Add Inventory (Hard)

Add an inventory system:

1. **Update GameState**:
   ```cpp
   struct GameState {
       // ... existing fields ...
       vector<string> inventory;  // Add this
   };
   ```

2. **Display inventory** in `printStatus()`:
   ```cpp
   cout << "Items: ";
   for (const string& item : state.inventory) {
       cout << "[" << item << "] ";
   }
   cout << "\n";
   ```

3. **Add items** in `runScene()` after a choice:
   ```cpp
   // Example: if choice 0 selected, add an item
   if (choiceIndex == 0) {
       state.inventory.push_back("Access Card");
   }
   ```

4. **Test it**: Can you see items appearing in your status?

### Exercise 4: Conditional Choices (Advanced)

Make some choices only appear if the player has an item:

1. **Extend Choice struct**:
   ```cpp
   struct Choice {
       string text;
       string nextSceneId;
       string requiredItem;  // Add this (empty string = no requirement)
   };
   ```

2. **Filter choices** in `runScene()`:
   ```cpp
   // Before printing choices, check requirements
   vector<Choice> availableChoices;
   for (const Choice& c : scene.choices) {
       bool canUse = true;
       if (!c.requiredItem.empty()) {
           // Check if player has this item
           bool hasItem = false;
           for (const string& item : state.inventory) {
               if (item == c.requiredItem) {
                   hasItem = true;
                   break;
               }
           }
           canUse = hasItem;
       }
       if (canUse) {
           availableChoices.push_back(c);
       }
   }
   // Use availableChoices instead of scene.choices
   ```

## 🧠 Understanding Key Concepts

### Why Use Functions?

**Before functions**:
```cpp
int main() {
    // 500 lines of code here
    cout << "Scene title\n";
    // get input
    // validate input
    // process choice
    // display results
    // ... everything in one place
}
```

**After functions**:
```cpp
int main() {
    initialize();
    while (notDone()) {
        displayScene();
        processChoice();
    }
}
```

**Benefits**:
- Each function is small and testable
- Easy to find where something happens
- Can reuse functions
- main() shows the big picture

### Why Pass by Reference?

**By value** (makes a copy):
```cpp
void displayStatus(GameState state) {  // Copies entire GameState
    // If GameState is big, this is slow
}
```

**By reference** (no copy):
```cpp
void displayStatus(const GameState& state) {  // Just a reference
    // Fast! No copying
    // const prevents accidental changes
}
```

### Why Use Structs?

**Without structs**:
```cpp
string sceneId;
string sceneTitle;
vector<string> sceneNarrative;
vector<Choice> sceneChoices;
// Hard to keep track of what goes together
```

**With structs**:
```cpp
struct Scene {
    string id;
    string title;
    vector<string> narrative;
    vector<Choice> choices;
};
Scene myScene;  // All related data in one place
```

## 📈 Progressive Learning Path

### Week 1: Read and Understand
- Read all comments
- Trace through main()
- Run the program multiple times
- Do Exercise 1 (modify display)

### Week 2: Modify Content
- Do Exercise 2 (add scenes)
- Change the story to your own theme
- Add more stress boxes (make it 5 instead of 3)

### Week 3: Add Features
- Do Exercise 3 (inventory)
- Add a simple scoring system
- Track number of scenes visited

### Week 4: Advanced Features
- Do Exercise 4 (conditional choices)
- Save/load game state to a file
- Add color output (research ANSI escape codes)

## 🎓 Assessment Questions

Test your understanding:

1. **Why does `printStatus()` take `const GameState&` instead of `GameState`?**
   <details>
   <summary>Answer</summary>
   - `&` (reference) avoids copying the entire struct (efficient)
   - `const` prevents accidental modification (safe)
   - Together: efficient and safe
   </details>

2. **What does `findScene()` return and why?**
   <details>
   <summary>Answer</summary>
   Returns `Scene*` (pointer to Scene). The pointer can be `nullptr` to signal "scene not found", which is how we know when the game ends.
   </details>

3. **Why is the story data in a separate function (`createStoryScenes()`)?**
   <details>
   <summary>Answer</summary>
   - Separates data from logic
   - Makes main() cleaner
   - Easier to replace with file loading later
   - Could move to a separate file entirely
   </details>

4. **How would you add a "skip to end" debug command?**
   <details>
   <summary>Answer</summary>
   In `getPlayerChoice()`, check for a special input like 999:
   ```cpp
   if (choice == 999) {
       state.currentSceneId = "ending_trust";  // Jump to ending
       return 0;  // Return any valid index
   }
   ```
   </details>

## 🚀 Next Steps

After mastering this example:

1. **Build your own** narrative game with a different theme
2. **Port to C++17** and use features like `std::optional`
3. **Add graphics** using a library like ncurses or SDL
4. **Load from JSON** using a library like nlohmann/json
5. **Add networking** for multiplayer choices

## 📚 Additional Resources

- [C++ Reference](https://en.cppreference.com/)
- [Learn C++](https://www.learncpp.com/) - Free tutorial
- [Game Programming Patterns](https://gameprogrammingpatterns.com/) - Free book
- Python prototype: See the more advanced features in the Python version

---

**Remember**: The best way to learn is by doing. Start with small modifications and gradually build up to bigger changes. Every expert programmer started by modifying example code!
