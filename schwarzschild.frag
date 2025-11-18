#version 330 core
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 iPosition;
uniform mat4 iView;
uniform mat4 iProjection;
uniform int iSteps;
uniform float iStep;
out vec4 FragColor;

#define PI 3.14159265359

vec2 f(vec2 u) {
	float u0 = u.x;
	float u1 = u.y;
	return vec2(u1, 3*u0*u0 - u0);
}

vec2 rk4Step(vec2 u, float h) {
	vec2 k1 = f(u);
	vec2 k2 = f(u + k1 * h * 0.5);
	vec2 k3 = f(u + k2 * h * 0.5);
	vec2 k4 = f(u + k3 * h);
	return u + (k1 + 2.0 * k2 + 2.0 * k3 + k4) * (h / 6.0);
}

mat3 Rx(float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return mat3(
		1.0, 0.0, 0.0,
		0.0,   c,   s,
		0.0,  -s,   c
	);
}
mat3 Ry(float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return mat3(
		  c, 0.0,  -s,
		0.0, 1.0, 0.0,
		  s, 0.0,   c
	);
}
mat3 Rz(float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return mat3(
		  c,   s, 0.0,
		 -s,   c, 0.0,
		0.0, 0.0, 1.0
	);
}
mat3 R(vec3 position, vec3 direction) {
	float phi = atan(position.y, position.x);
	float theta = acos(position.z / length(position));
	mat3 R = Ry(PI/2-theta) * Rz(-phi);
	direction = R * direction;
	float alpha = atan(direction.z, direction.y);
	return Rx(-alpha) * R;
}

vec3 trace(vec3 position, vec3 direction) {

	mat3 R = R(position, direction);
	//position = R * position;
	direction = R * direction;

	vec2 dir = (R * vec3(0.0, 0.0, 1.0)).xy;
	float ph0 = atan(dir.y,dir.x) + PI/2;
	while (ph0 >= PI) ph0 -= PI;
	while (ph0 < 0.0) ph0 += PI;

	float u0 = 1.0 / length(position);
	float u1 = u0*u0*direction.x/direction.y;
	vec2 u = vec2(u0, u1);

	vec3 color = vec3(u.x);

	float ph = 0.0;
	for (int i = 0; i < iSteps; i++) {
		u = rk4Step(u, iStep);
		ph += iStep;
		if (PI < ph && ph < 2*PI) ph -= PI;
		if (ph > 2*PI) break;

		if (u.x > 0.5) {
			color = vec3(0.0);
			break;
		}
		if (abs(ph-ph0) < iStep) {
			if (0.2 < u.x && u.x < 0.4) {
				color = vec3(0.9, 0.7, 0.1) * float(iSteps-i)/float(iSteps)*1.5;
				break;
			}
		}
	}

	return color;
}


void main() {
	vec2 uv = gl_FragCoord.xy / iResolution.xy;
	vec4 ndc = vec4(uv * 2.0 - 1.0, -1.0, 1.0);
	vec4 view = inverse(iProjection) * ndc; view /= view.w;
	vec4 world = inverse(iView) * view;

	vec3 direction = normalize(world.xyz - iPosition);
	vec3 position = iPosition;



	FragColor = vec4(trace(position,direction), 1.0);
}