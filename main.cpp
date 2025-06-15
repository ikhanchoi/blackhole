#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"

#include "include/gif.h"
#include <thread>
#include <queue>
#include <condition_variable>
#include <atomic>
#include <cstring>



std::queue<std::vector<uint8_t>> frameQueue;
std::mutex queueMutex;
std::condition_variable frameReady;
std::atomic<bool> stopEncoding = false;
std::thread encodingThread;
GifWriter gif;
bool recording = false, recording_prev = false;
int frameCount = 0;

void encodingThreadFunc(GifWriter* writer, int width, int height) {
    while (!stopEncoding || !frameQueue.empty()) {
        std::unique_lock<std::mutex> lock(queueMutex);
        frameReady.wait(lock, [] {
            return !frameQueue.empty() || stopEncoding;
        });
        while (!frameQueue.empty()) {
            auto frame = std::move(frameQueue.front());
            frameQueue.pop();
            lock.unlock();
            GifWriteFrame(writer, frame.data(), width, height, 10);
            lock.lock();
        }
    }
	GifEnd(writer);
}

void startRecording(int width, int height) {
    if (encodingThread.joinable()) return;
    stopEncoding = false;
    GifBegin(&gif, "output.gif", width, height, 10);
    encodingThread = std::thread(encodingThreadFunc, &gif, width, height);
}

void stopRecording() {
    stopEncoding = true;
    frameReady.notify_all();
    if (encodingThread.joinable()) encodingThread.join();
    {
        std::lock_guard<std::mutex> lock(queueMutex);
        while (!frameQueue.empty())
            frameQueue.pop();
    }
}

void captureFrame(int width, int height) {
    glReadBuffer(GL_FRONT);
	std::vector<GLubyte> frame(width * height * 4);
    glReadPixels(0, 0, width, height, GL_RGBA, GL_UNSIGNED_BYTE, frame.data());
	std::vector<GLubyte> flipped(width * height * 4);
	for (int i = 0; i < height; ++i) {
		int from = i * width * 4;
		int to = (height - 1 - i) * width * 4;
		std::memcpy(&flipped[to], &frame[from], width * 4);
	}
	{
		std::lock_guard<std::mutex> lock(queueMutex);
		frameQueue.push(std::move(flipped));
	}
	frameReady.notify_one();
}

void key_callback(GLFWwindow* window, int key, int scancode, int action, int mods) {
	if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS)
		glfwSetWindowShouldClose(window, true);
	if (key == GLFW_KEY_R && action == GLFW_PRESS)
		recording = !recording;
}






// camera position in spherical coordinates
float r = 1.0f;
float th = glm::radians(90.0f);
float ph = glm::radians(270.0f);

// mouse processing
bool isDragging = false;
double up, vp;
const double sensitivity = 0.005f;
const double eps = 0.01f;

void mouse_button_callback(GLFWwindow* window, int button, int action, int mods) {
	if (button == GLFW_MOUSE_BUTTON_LEFT) {
		if (action == GLFW_PRESS) {
			isDragging = true;
			glfwGetCursorPos(window, &up, &vp);
		} else if (action == GLFW_RELEASE) {
			isDragging = false;
		}
	}
}
void cursor_position_callback(GLFWwindow* window, double u, double v) {
	if (isDragging) {
		ph -= (float)((u - up) * sensitivity);
		th -= (float)((v - vp) * sensitivity);
		if (th < eps) th = (float)eps;
		if (th > glm::pi<double>() - eps) th = (float)(glm::pi<double>() - eps);
		up = u, vp = v;
	}
}





int main() {

	int width = 800, height = 600;

	/*----------------*/
	/* Initialization */
	/*----------------*/

	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
#ifdef __APPLE__
	glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif
	GLFWwindow *window = glfwCreateWindow(width, height, "Black hole", nullptr, nullptr);
	glfwMakeContextCurrent(window);

	glfwSetKeyCallback(window, key_callback);
	glfwSetMouseButtonCallback(window, mouse_button_callback);
	glfwSetCursorPosCallback(window, cursor_position_callback);

	glewInit();

	IMGUI_CHECKVERSION();
	ImGui::CreateContext();
	ImGuiIO &io = ImGui::GetIO();
	(void) io;
	ImGui::StyleColorsDark();
	ImGui_ImplGlfw_InitForOpenGL(window, true);
	ImGui_ImplOpenGL3_Init("#version 330");


	/*-------------------*/
	/* Prepare resources */
	/*-------------------*/

	float quad[] = {-1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1};
	GLuint bufferObject;
	glGenBuffers(1, &bufferObject);
	glBindBuffer(GL_ARRAY_BUFFER, bufferObject);
	glBufferData(GL_ARRAY_BUFFER, sizeof(quad), quad, GL_STATIC_DRAW);

	std::ifstream vfs("../quad.vert");
	std::ifstream ffs("../kerr.frag");
	std::stringstream vss;
	std::stringstream fss;
	vss << vfs.rdbuf();
	fss << ffs.rdbuf();
	vfs.close();
	ffs.close();
	std::string vCode = vss.str();
	std::string fCode = fss.str();
	const char *vSrc = vCode.c_str();
	const char *fSrc = fCode.c_str();
	GLuint vShader = glCreateShader(GL_VERTEX_SHADER);
	glShaderSource(vShader, 1, &vSrc, nullptr);
	glCompileShader(vShader);
	GLuint fShader = glCreateShader(GL_FRAGMENT_SHADER);
	glShaderSource(fShader, 1, &fSrc, nullptr);
	glCompileShader(fShader);
	int success;
	glGetShaderiv(vShader, GL_COMPILE_STATUS, &success);
	if (!success) {
		char infoLog[512];
		glGetShaderInfoLog(vShader, 512, NULL, infoLog);
		std::cerr << infoLog << '\n';
	}
	glGetShaderiv(fShader, GL_COMPILE_STATUS, &success);
	if (!success) {
		char infoLog[512];
		glGetShaderInfoLog(fShader, 512, NULL, infoLog);
		std::cerr << infoLog << '\n';
	}


	/*-----------------------*/
	/* Prepare render states */
	/*-----------------------*/

	GLuint vertexArrayObject;
	glGenVertexArrays(1, &vertexArrayObject);
	glBindVertexArray(vertexArrayObject);
	glBindBuffer(GL_ARRAY_BUFFER, bufferObject);
	glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void *) 0);
	glEnableVertexAttribArray(0);

	GLuint program = glCreateProgram();
	glAttachShader(program, vShader);
	glAttachShader(program, fShader);
	glLinkProgram(program);


	// OpenGL setting
	glEnable(GL_BLEND);
	glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glClearColor(0.5f, 0.5f, 0.5f, 1.0f);
	glBindVertexArray(vertexArrayObject);
	glUseProgram(program);



    while (!glfwWindowShouldClose(window)) {
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

		glfwGetFramebufferSize(window, &width, &height);
		glViewport(0, 0, width, height);
		glUniform2f(glGetUniformLocation(program, "iResolution"), (float)width, (float)height);
		glUniform1f(glGetUniformLocation(program, "iTime"), (float)glfwGetTime());

		glm::vec3 position(r * sin(th) * cos(ph), r * sin(th) * sin(ph), r * cos(th));
        glm::mat4 view = glm::lookAt(position, glm::vec3(0.0f), glm::vec3(0.0f, 0.0f, 1.0f));
		glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)(width)/(float)(height), 0.1f, 100.0f);
		glUniform3f(glGetUniformLocation(program, "iPosition"), position.x, position.y, position.z);
		glUniformMatrix4fv(glGetUniformLocation(program, "iView"), 1, GL_FALSE, &view[0][0]);
		glUniformMatrix4fv(glGetUniformLocation(program, "iProjection"), 1, GL_FALSE, &projection[0][0]);

		glDrawArrays(GL_TRIANGLES, 0, 6);

		// record gif
		if (recording != recording_prev) {
			if (recording) startRecording(width, height);
			else if (!recording) stopRecording();
			recording_prev = recording;
		}
		if (recording && frameCount % 6 == 0)
			captureFrame(width, height);
		frameCount++;

		// mouse processing, in fact, registration of callback is faster


		// print FPS
		ImGui_ImplOpenGL3_NewFrame(), ImGui_ImplGlfw_NewFrame(), ImGui::NewFrame();
		ImGui::Begin("Black hole");
		ImGui::Text("FPS: %.1f", ImGui::GetIO().Framerate);
		ImGui::Text("Recording: %s", recording ? "ON" : "OFF");
		ImGui::End();
		ImGui::Render();
		ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());

		// swapping buffer
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

	ImGui_ImplOpenGL3_Shutdown();
	ImGui_ImplGlfw_Shutdown();
	ImGui::DestroyContext();

	glDeleteVertexArrays(1, &vertexArrayObject);
	glDeleteBuffers(1, &bufferObject);
	glDeleteProgram(program);

	glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
