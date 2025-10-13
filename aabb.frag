#version 330 core
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 iPosition;
uniform mat4 iView;
uniform mat4 iProjection;
out vec4 FragColor;


vec2 intersectAABB(vec3 ro, vec3 rd) {
    vec3 tMin = (vec3(-0.1) - ro) / rd;
    vec3 tMax = (vec3(0.1) - ro) / rd;
    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);
    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar = min(min(t2.x, t2.y), t2.z);
    if (tNear > tFar || tFar < 0.0)
        return vec2(-1.0);
    return vec2(tNear, tFar);
}

vec3 traceColor(vec3 position, vec3 direction) {
    vec2 tHit = intersectAABB(position, direction);
    if (tHit.x > 0.0)
        return vec3(0.3 + position + direction * tHit.x * 1.2);
    else
        return vec3(0.0);
}

void main() {
    vec4 clip = vec4((gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0, -1.0, 1.0);
    vec4 eye = vec4((inverse(iProjection) * clip).xy, -1.0, 0.0);
    vec3 direction = normalize((inverse(iView) * eye).xyz);
    vec3 position = iPosition;

    FragColor = vec4(traceColor(position, direction), 1.0);
}


