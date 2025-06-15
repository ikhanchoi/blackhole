#version 330 core
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 iPosition;
uniform mat4 iView;
uniform mat4 iProjection;
out vec4 FragColor;

/*
const float M = 1.0;
const float a = 0.9;

struct RayState {
    float r;
    float theta;
    float phi;
    float pr;
    float ptheta;
};


float Sigma(float r, float theta) { return r * r + a * a * cos(theta) * cos(theta); }
float Delta(float r) { return r * r - 2.0 * M * r + a * a; }

float R_func(float r, float pr, float E, float Lz, float Q) {
    float term = (r * r + a * a) * E - a * Lz;
    return term * term - Delta(r) * (Q + (Lz - a * E) * (Lz - a * E));
}
float Theta_func(float theta, float ptheta, float E, float Lz, float Q) {
    return Q - cos(theta) * cos(theta) * (a * a * (1.0 - E * E) + Lz * Lz / sin(theta) / sin(theta));
}

float dRdr(float r, float E, float Lz, float Q) {
    float h = 1e-5;
    return (R_func(r + h, 0.0f, E, Lz, Q) - R_func(r - h, 0.0f, E, Lz, Q)) / (2.0f * h);
}

RayState derivatives(RayState s, float E, float Lz, float Q) {
    RayState ds;

    float cos_theta = cos(s.theta);
    float sin_theta = sin(s.theta);
    float sin_theta2 = sin_theta * sin_theta;

    float Sigma_val = Sigma(s.r, s.theta);
    float Delta_val = Delta(s.r);

    float term1 = (s.r * s.r + a * a) * E - a * Lz;
    float Rr = term1 * term1 - Delta_val * (Q + (Lz - a * E) * (Lz - a * E));

    float Theta_theta = Q - cos_theta * cos_theta * (a * a * (1.0 - E * E) + Lz * Lz / sin_theta2);


    ds.r = s.pr * Delta_val / Sigma_val;
    ds.theta = s.ptheta / Sigma_val;

    ds.phi = (Lz / sin_theta2 - a * E + a * term1 / Delta_val) / Sigma_val;

    ds.pr = dRdr(s.r, E, Lz, Q) / (2.0f * s.pr * Sigma_val);


    ds.ptheta = -0.5 * (-2.0 * cos_theta * sin_theta * (a * a * (1.0 - E * E) + Lz * Lz / sin_theta2)
                + Q * 0.0) / Sigma_val;


    return ds;
}




void main() {

    vec2 uv = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;

    vec4 rayClip = vec4(uv, -1.0, 1.0);
    vec4 rayEye = inverse(iProjection) * rayClip;
    rayEye /= rayEye.w;
    rayEye = vec4(rayEye.xyz, 0.0);
    vec3 rayDir = normalize((inverse(iView) * rayEye).xyz);
    vec3 rayOrigin = iCameraPos;

    // Boyer-Lindquist iniailization
    float r = length(rayOrigin);
    float theta = acos(rayOrigin.z / length(rayOrigin));
    float phi = atan(rayOrigin.y, rayOrigin.x);
    float pr = dot(rayDir, vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)));
    float ptheta = dot(rayDir, vec3(cos(theta) * cos(phi), cos(theta) * sin(phi), -sin(theta)));
    float pphi = dot(rayDir, vec3(-sin(phi), cos(phi), 0.0));


    RayState ray;
    ray.r = r;
    ray.theta = theta;
    ray.phi = phi;
    ray.pr = pr;
    ray.ptheta = ptheta;


    float E = 1.0;
    float Lz = 2.0;
    float Q = 2.0;

    float dt = 0.02;
    int steps = 100;
    bool hitDisk = false;
    bool fall = false;
    bool far = false;

    for(int i = 0; i < steps; i++) {
        // Euler 적분
        RayState ds = derivatives(ray, E, Lz, Q);
        ray.r += ds.r * dt;
        ray.theta += ds.theta * dt;
        ray.phi += ds.phi * dt;
        ray.pr += ds.pr * dt;
        ray.ptheta += ds.ptheta * dt;

        if(abs(ray.theta - 3.1415/2.0) < 0.1 && ray.r > 0.12 && ray.r < 1.0) {
            hitDisk = true;
            break;
        }

        if(ray.r < 0.99) {
            fall = true;
            break;
        }

        if(ray.r > 10.0) {
            far = true;
            break;
        }
    }

    vec3 color = hitDisk ? vec3(1.0, 0.6, 0.1) : vec3(0.0);





    vec3 color_initial_momentum = vec3(0.5)+ vec3(ray.pr/2) * 0.5;

    vec3 color_final_r = fall ? vec3(0.0) : vec3(ray.r);

    vec3 color_final_theta = fall ? vec3(0.0) : vec3(ray.theta / 3.1415);


    FragColor = vec4(color, 1.0);



}

*/


vec2 intersectAABB(vec3 ro, vec3 rd) {
    vec3 tMin = (vec3(-0.1) - ro) / rd;
    vec3 tMax = (vec3(0.1) - ro) / rd;
    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);
    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar = min(min(t2.x, t2.y), t2.z);
    if (tNear > tFar || tFar < 0.0) return vec2(-1.0);
    return vec2(tNear, tFar);
}

void main() {
    vec2 uv = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;

    vec4 rayClip = vec4(uv, -1.0, 1.0);
    vec4 rayEye = inverse(iProjection) * rayClip;
    rayEye = vec4(rayEye.xy, -1.0, 0.0);
    vec3 rayDir = normalize((inverse(iView) * rayEye).xyz);
    vec3 rayOrigin = iPosition;

    vec2 tHit = intersectAABB(rayOrigin, rayDir);
    if (tHit.x > 0.0) {
        vec3 hitPoint = rayOrigin + rayDir * tHit.x;
        FragColor = vec4(0.3 + hitPoint * 1.2, 1.0);
    } else {
        FragColor = vec4(uv.x * 0.5, uv.y * 0.5, 0.0, 1.0);
    }
}


