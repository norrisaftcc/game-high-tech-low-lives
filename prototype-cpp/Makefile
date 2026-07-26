# Makefile for Narrative Game Engine Teaching Example
# This demonstrates basic Makefile usage for students

# Compiler to use
CXX = g++

# Compiler flags
# -Wall: Enable all warnings
# -Wextra: Enable extra warnings
# -std=c++11: Use C++11 standard
CXXFLAGS = -Wall -Wextra -std=c++11

# Target executable name
TARGET = narrative_game

# Source files
SOURCES = narrative_game.cpp

# Object files (replace .cpp with .o)
OBJECTS = $(SOURCES:.cpp=.o)

# Default target - builds the executable
all: $(TARGET)

# Link object files to create executable
$(TARGET): $(OBJECTS)
	@echo "Linking $(TARGET)..."
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(OBJECTS)
	@echo "Build complete! Run with: ./$(TARGET)"

# Compile source files to object files
%.o: %.cpp
	@echo "Compiling $<..."
	$(CXX) $(CXXFLAGS) -c $< -o $@

# Run the program
run: $(TARGET)
	@echo "Running $(TARGET)..."
	@echo ""
	./$(TARGET)

# Clean up compiled files
clean:
	@echo "Cleaning up..."
	rm -f $(TARGET) $(OBJECTS)
	@echo "Clean complete!"

# Rebuild everything from scratch
rebuild: clean all

# Debug build with symbols
debug: CXXFLAGS += -g
debug: clean $(TARGET)
	@echo "Debug build complete! Use with: gdb ./$(TARGET)"

# Display help information
help:
	@echo "Narrative Game Engine - Makefile Help"
	@echo ""
	@echo "Available targets:"
	@echo "  make          - Build the program (default)"
	@echo "  make all      - Same as 'make'"
	@echo "  make run      - Build and run the program"
	@echo "  make clean    - Remove compiled files"
	@echo "  make rebuild  - Clean and rebuild"
	@echo "  make debug    - Build with debugging symbols"
	@echo "  make help     - Show this help message"
	@echo ""
	@echo "Examples:"
	@echo "  make && ./narrative_game    - Build and run manually"
	@echo "  make run                     - Build and run automatically"

# Mark these targets as not being files
.PHONY: all clean run rebuild debug help
