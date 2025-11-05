# C++ Narrative Game Engine - Teaching Prototype

A simplified text-based narrative game demonstrating C++ programming fundamentals. This prototype is based on the "High Tech, Low Lives" cyberpunk RPG Python prototype but streamlined for teaching purposes.

## 🎯 Learning Objectives

This program teaches:

1. **Function Decomposition** - Breaking complex programs into focused, single-purpose functions
2. **Data Structures** - Using structs to organize related data
3. **Pass-by-Reference** - Efficient parameter passing with const correctness
4. **Input Validation** - Robust handling of user input
5. **Code Organization** - Logical grouping and documentation
6. **Game State Management** - Tracking and updating program state

## 📚 For Students

### Key Concepts Demonstrated

#### 1. **Structs for Data Organization**

```cpp
struct Scene {
    string id;
    string title;
    vector<string> narrative;
    vector<Choice> choices;
};
```

**Why?** Structs group related data together. A scene has an ID, title, narrative text, and choices - these belong together as a conceptual unit.

#### 2. **Function Decomposition**

Instead of one giant `main()` function, we break the program into focused functions:

- `printStatus()` - Display game state
- `printNarrative()` - Show story text
- `getPlayerChoice()` - Get validated input
- `runScene()` - Orchestrate scene logic

**Why?** Each function does one thing well. This makes code:
- Easier to understand
- Easier to test
- Easier to modify
- Reusable

#### 3. **Const Correctness**

```cpp
void printStatus(const GameState& state)
```

**Why?**
- `const` signals this function only reads data, never modifies it
- `&` (reference) avoids copying the entire struct
- Together: efficient and safe

#### 4. **Input Validation**

```cpp
int getPlayerChoice(int maxChoice) {
    int choice;
    while (true) {
        cin >> choice;
        if (cin.fail()) {
            cin.clear();
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            // ... handle error
        }
        // ... validate range
    }
}
```

**Why?** Never trust user input! Always validate and handle errors gracefully.

## 🚀 Compiling and Running

### Quick Start

```bash
# Compile
g++ -o narrative_game narrative_game.cpp

# Run
./narrative_game
```

### With Makefile

```bash
# Compile
make

# Run
make run

# Clean up
make clean
```

### Compilation Options

For students learning about compiler flags:

```bash
# With warnings enabled (recommended for learning)
g++ -Wall -Wextra -o narrative_game narrative_game.cpp

# With C++11 features
g++ -std=c++11 -Wall -o narrative_game narrative_game.cpp

# With debugging symbols (for use with gdb)
g++ -g -Wall -o narrative_game narrative_game.cpp
```

## 🎮 Playing the Game

The game presents a cyberpunk scenario where you guide an enforcer through a mission. At each scene:

1. Read the narrative text
2. Review available actions
3. Enter your choice number (1, 2, 3, etc.)
4. See the consequences of your choice

Different choices lead to different story branches and endings.

## 📖 Code Structure

```
narrative_game.cpp
├── Data Structures (lines ~35-70)
│   ├── Choice struct
│   ├── Scene struct
│   └── GameState struct
│
├── Function Declarations (lines ~72-87)
│
├── main() function (lines ~89-108)
│   └── Simple, high-level game loop
│
├── Display Functions (lines ~110-175)
│   ├── printHeader()
│   ├── printDivider()
│   ├── printStatus()
│   ├── printNarrative()
│   └── printChoices()
│
├── Game Logic Functions (lines ~177-280)
│   ├── getPlayerChoice() - Input validation
│   ├── findScene() - Scene lookup
│   └── runScene() - Scene execution
│
└── Story Content (lines ~282-end)
    └── createStoryScenes() - All game content
```

## 🔧 Extending the Example

### Beginner Extensions

1. **Add more scenes** - Follow the pattern in `createStoryScenes()`
2. **Change the narrative** - Modify the story text
3. **Customize display** - Adjust the formatting functions

### Intermediate Extensions

1. **Add inventory system** - Track items in GameState
2. **Implement stress changes** - Modify stress values based on choices
3. **Add conditional choices** - Only show choices if conditions are met
4. **Add save/load** - Write GameState to a file

### Advanced Extensions

1. **JSON-based story files** - Load scenes from external files
2. **Combat system** - Implement dice-rolling mechanics
3. **Multiple characters** - Track stats for different characters
4. **Quest system** - Track objectives and completion

## 💡 Teaching Notes

### For Instructors

This example is designed to be:

1. **Self-contained** - No external dependencies
2. **Well-commented** - Comments explain WHY, not just WHAT
3. **Progressively complex** - Start simple, add features gradually
4. **Real-world applicable** - Patterns used in actual game development

### Suggested Teaching Sequence

1. **Week 1**: Review structs and basic functions
   - Focus on `printStatus()`, `printNarrative()`
   - Students modify display formatting

2. **Week 2**: Input validation and control flow
   - Deep dive into `getPlayerChoice()`
   - Students add error handling to their own projects

3. **Week 3**: Pointers and references
   - Explain `findScene()` return type
   - Discuss pass-by-reference in `runScene()`

4. **Week 4**: Data organization and scaling
   - Review `createStoryScenes()`
   - Students design their own scene structure

## 🌟 Key Takeaways

Students should understand:

1. **Functions manage complexity** - Break big problems into small pieces
2. **Structs organize data** - Group related information
3. **const & is powerful** - Efficient and safe
4. **Validation matters** - Always check input
5. **Organization helps** - Code should tell a story

## 📚 Related Python Prototype

This C++ version is simplified from a more feature-rich Python prototype that includes:
- ANSI color terminal output
- JSON-based story loading
- Pydantic data validation
- Combat system
- Complex branching narratives

See: [Python Narrative Engine](https://github.com/norrisaftcc/game-high-tech-low-lives/tree/spike/python-narrative-engine/prototype)

## 📝 License

Part of the "High Tech, Low Lives" RPG project - educational prototype.

## 🤝 Contributing

Students are encouraged to:
- Add new scenes and story branches
- Improve the display formatting
- Add new game mechanics
- Share your extensions!

---

**Next Steps:** After understanding this example, try building your own narrative engine with a different theme, or extend this one with the features listed above!
