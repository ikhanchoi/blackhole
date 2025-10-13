#version 330 core
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 iPosition;
uniform mat4 iView;
uniform mat4 iProjection;
out vec4 FragColor;


const float M = 1.0;
const float a = 0.9;


struct State {
    vec4 x;
    vec4 u;
};


State derivative(State Y) {



    // Christoffel symbols
    mat4x4 Gamma[4];

    vec4 dudtau = vec4(0.0);
    for(int mu=0; mu<4; mu++)
        for(int nu=0; nu<4; nu++)
            for(int rho=0; rho<4; rho++)
                dudtau[mu] += -Gamma[mu][nu][rho] * Y.u[nu] * Y.u[rho];
    return State(Y.u, dudtau);
}



State rk4Step(State Y, float h) {
    State k1 = derivative(Y);
    State k2 = derivative(State(Y.x + k1.x * (h * 0.5), Y.u + k1.u * (h * 0.5)));
    State k3 = derivative(State(Y.x + k2.x * (h * 0.5), Y.u + k2.u * (h * 0.5)));
    State k4 = derivative(State(Y.x + k3.x * h, Y.u + k3.u * h));
    return State(
        Y.x + (k1.x + 2.0 * k2.x + 2.0 * k3.x + k4.x) * (h / 6.0),
        Y.u + (k1.u + 2.0 * k2.u + 2.0 * k3.u + k4.u) * (h / 6.0));
}




vec3 traceColor(vec3 position, vec3 direction) {

    State Y = State(vec4(position, 1.0), vec4(direction, 0.0));










    float h = 0.02;
    int steps = 100;

    bool hit = false;
    bool fall = false;
    bool far = false;

    for(int i = 0; i < steps; i++) {
        Y = rk4Step(Y, h);

        float b = a * a - dot(Y.x.xyz, Y.x.xyz);
        float c = a * a * Y.x.z * Y.x.z;
        float r = sqrt(0.5 * (- b + sqrt(b * b - 4.0 * c)));
        float th = acos(Y.x.z / r);

        if(abs(th - 3.1415/2.0) < 0.1 && r > 0.12 && r < 1.0) { //
            hit = true; break;
        }
        if(r * r - 2.0 * M * r + a * a < 0.0) {
            fall = true; break;
        }
        if(r > 1000.0) { //
            far = true; break;
        }
    }



    vec3 color;
    int option = 0;
    if (option == 0)
        color = hit ? vec3(1.0, 0.6, 0.1) : vec3(0.0);
    else if (option == 1)
        color = vec3(0.5)+ vec3(ray.pr/2) * 0.5; // initial momentum
    else if (option == 2)
        color = fall ? vec3(0.0) : vec3(ray.r); // final radius
    else if (option == 3)
        color = fall ? vec3(0.0) : vec3(ray.theta / 3.1415); // final theta

    return color;
}


void main() {
    vec4 clip = vec4((gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0, -1.0, 1.0);
    vec4 eye = vec4((inverse(iProjection) * clip).xy, -1.0, 0.0);
    vec3 direction = normalize((inverse(iView) * eye).xyz);
    vec3 position = iPosition;

    FragColor = vec4(traceColor(position, direction), 1.0);
}