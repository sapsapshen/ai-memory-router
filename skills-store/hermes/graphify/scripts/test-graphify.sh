#!/bin/bash
# Test script for graphify skill
# This script creates a test directory and runs graphify on it

set -e

echo "Testing graphify installation..."

# Check if virtual environment exists
VENV_PATH="$HOME/.hermes/venv/graphify"
if [ ! -d "$VENV_PATH" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_PATH"
fi

# Activate virtual environment
source "$VENV_PATH/bin/activate"

# Check if graphify is installed
if ! command -v graphify &> /dev/null; then
    echo "Installing graphifyy..."
    pip install graphifyy
fi

# Create test directory
TEST_DIR="/tmp/graphify-test-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "Created test directory: $TEST_DIR"

# Create sample Python file
cat > hello.py << 'EOF'
"""Sample Python module for graphify testing."""

def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}!"

class Person:
    """A simple person class."""
    
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age
    
    def introduce(self) -> str:
        """Return introduction string."""
        return f"I'm {self.name}, {self.age} years old."

if __name__ == "__main__":
    person = Person("Alice", 30)
    print(greet(person.name))
    print(person.introduce())
EOF

# Create sample markdown file
cat > README.md << 'EOF'
# Test Project

This is a test project for graphify.

## Features
- Sample Python code
- Documentation
- Testing graphify functionality

## Architecture
The project has:
1. `hello.py` - Main module with greeting functionality
2. `Person` class - Represents a person with name and age
3. `greet` function - Returns greeting message
EOF

echo "Created test files:"
ls -la

# Run graphify
echo -e "\nRunning graphify..."
graphify .

# Check output
if [ -d "graphify-out" ]; then
    echo -e "\nGraphify output created successfully!"
    echo "Contents of graphify-out/:"
    ls -la graphify-out/
    
    if [ -f "graphify-out/GRAPH_REPORT.md" ]; then
        echo -e "\nFirst 10 lines of GRAPH_REPORT.md:"
        head -10 graphify-out/GRAPH_REPORT.md
    fi
    
    if [ -f "graphify-out/graph.html" ]; then
        echo -e "\nGraph HTML file created: graphify-out/graph.html"
    fi
else
    echo "ERROR: graphify-out directory not created!"
    exit 1
fi

echo -e "\nTest completed successfully!"
echo "Test directory: $TEST_DIR"
echo "You can examine the output files there."