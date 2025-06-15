cmake_minimum_required(VERSION 3.27)
project(blackhole)
set(CMAKE_CXX_STANDARD 17)

# glew, glfw, glm
find_package(GLEW REQUIRED)
find_package(glfw3 REQUIRED)
find_package(glm REQUIRED)

# imgui
add_library(imgui STATIC
    include/imgui/imgui.cpp
	include/imgui/imgui_demo.cpp
    include/imgui/imgui_draw.cpp
    include/imgui/imgui_tables.cpp
    include/imgui/imgui_widgets.cpp
    include/imgui/backends/imgui_impl_glfw.cpp
    include/imgui/backends/imgui_impl_opengl3.cpp
    include/imgui/misc/cpp/imgui_stdlib.cpp)
target_include_directories(imgui PUBLIC
		${CMAKE_CURRENT_SOURCE_DIR}/include/imgui
		${CMAKE_CURRENT_SOURCE_DIR}/include/imgui/backends)
target_link_libraries(imgui PRIVATE glfw)

# executable
add_executable(blackhole main.cpp)
target_link_libraries(blackhole PUBLIC GLEW::GLEW glfw imgui)
