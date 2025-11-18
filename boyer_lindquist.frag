#version 330 core
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 iPosition;
uniform mat4 iView;
uniform mat4 iProjection;
uniform int iSteps;
uniform float iTimeStep;
out vec4 FragColor;
//layout(rgba32f, binding = 0) writeonly uniform image2D rayPathImage;


const float a = 0.999;
const float a2 = a * a;
const float horizon = 1.0 + sqrt(1.0 - a2);


struct State {
    float r;
    float th;
    float ph;
    float p_r;
    float p_th;
};


// constants of motion
float E;
float Lz;
float Q;



vec3 derivative(vec3 Y) { // with respect to lambda
    float r = Y.x;
    float th = Y.y;
    float ph = Y.z;

    float r2 = r * r;
    float cos2_th = cos(th) * cos(th);
    float sin2_th = sin(th) * sin(th);

    float Sigma = r2 + a2 * cos2_th;
    float Delta = r2 - 2.0 * r + a2;

    float P = E * (r2 + a2) - a * Lz;
    float R = P * P - Delta * (Q + (Lz - a * E) * (Lz - a * E));
    float Th = Q - cos2_th * (Lz * Lz / sin2_th - a2 * E * E);

    //float u_t = (- a * (a * E * sin2_th - Lz) + (r2 + a2) * P / Delta) / Sigma;

    float dr_dl = + sqrt(R) / Sigma;
    float dth_dl = - sqrt(Th) / Sigma;
    float dph_dl = (Lz * Lz / sin2_th - a * E + a * P / Delta) / Sigma;

    return vec3(dr_dl, dth_dl, dph_dl);
}


State derivative(State Y) {
    float r = Y.r;
    float th = Y.th;
    float ph = Y.ph;
    float p_r = Y.p_r;
    float p_th = Y.p_th;

    float r2 = r * r;
    float p_r2 = p_r * p_r;
    float p_th2 = p_th * p_th;
    float cos_th = cos(th);
    float sin_th = sin(th);
    float cos2_th = cos_th * cos_th;
    float sin2_th = sin_th * sin_th;
    float sincos_th = sin_th * cos_th;

    float Sigma = r2 + a2 * cos2_th;
    float Sigma2 = Sigma * Sigma;
    float Delta = r2 - 2.0 * r + a2;
    float Delta2 = Delta * Delta;
    float P = E * (r2 + a2) - a * Lz;
    float R = P * P - Delta * (Q + (Lz - a * E) * (Lz - a * E));
    float Th = Q - cos2_th * (Lz * Lz / sin2_th - a2 * E * E);

    float dr_dl = p_r * Delta / Sigma;
    float dth_dl = p_th / Sigma;
    float dph_dl = (Lz * Lz / sin2_th - a * E + a * P / Delta) / Sigma;

    float dR_dr = 4.0 * P * E * r + 2.0 * (1 - r) * (Q + (Lz - a * E) * (Lz - a * E));
    float dp_r_dl =
        ((1.0 - r) * Sigma + r * Delta) * p_r2 + r * p_th2
        + ((dR_dr / 2.0 - (1.0 - r) * Th) * Delta * Sigma - (R + Delta * Th) * ((1.0 - r) * Sigma + r * Delta)) /
        Delta2;
    dp_r_dl /= Sigma2;

    float dTh_dth = - 2.0 * sincos_th * (Lz * Lz / sin2_th - a2 * E * E)
                    + cos2_th * (2.0 * Lz * Lz * cos_th / pow(sin_th, 3));
    float dp_th_dl =
        - a2 * Delta * sincos_th * p_r2 - a2 * sincos_th * p_th2
        + dTh_dth / 2.0 * Sigma - (R + Delta * Th) * a2 * sincos_th / Delta;
    dp_th_dl /= Sigma2;

    return State(dr_dl, dth_dl, dph_dl, dp_r_dl, dp_th_dl);
}


vec3 rk4Step(vec3 Y, float h) {
    vec3 k1 = derivative(Y);
    vec3 k2 = derivative(Y + k1 * (h * 0.5));
    vec3 k3 = derivative(Y + k2 * (h * 0.5));
    vec3 k4 = derivative(Y + k3 * h);
    return Y + (k1 + 2.0 * k2 + 2.0 * k3 + k4) * (h / 6.0);
}



vec3 traceColor(vec3 position, vec3 direction) {

    float b = a2 - dot(position, position);
    float c = a2 * position.z * position.z;
    float r2 = (- b + sqrt(b * b - 4.0 * c)) / 2.0;
    float r = sqrt(r2);
    float th = acos(clamp(position.z / r, -1.0, 1.0));
    float ph = position.x == 0.0 ? sign(position.y) * radians(90.0) : atan(position.y, position.x);

    float sin_th = sin(th);
    float cos_th = cos(th);
    float sin_ph = sin(ph);
    float cos_ph = cos(ph);
    float cos2_th = cos_th * cos_th;
    float sin2_th = sin_th * sin_th;

    float Sigma = r2 + a2 * cos2_th;
    float Delta = r2 - 2.0 * r + a2;

    float g_tt   = - 1.0 + 2.0 * r / Sigma;
    float g_tph  = - 2.0 * r * a * sin2_th / Sigma;
    float g_phph = sin2_th * (r2 + a2 + 2.0 * r * a2 * sin2_th / Sigma);
    float g_rr   = Sigma / Delta;
    float g_thth = Sigma;


    float n_r = sin_th * cos_ph * direction.x + sin_th * sin_ph * direction.y + cos_th * direction.z;
    float n_th = cos_th * cos_ph * direction.x + cos_th * sin_ph * direction.y - sin_th * direction.z;
    float n_ph = - sin_ph * direction.x + cos_ph * direction.y;

    float p_r = - n_r * sqrt(Delta / Sigma);
    float p_th = - n_th / sqrt(Sigma);
    float p_ph = - n_ph * sqrt(((r2 + a2) * (r2 + a2) - a2 * Delta * sin2_th) / Sigma) * sin_th;


    float A = g_tt;
    float B = 2.0 * g_tph * p_ph;
    float C = g_phph * p_ph * p_ph + g_rr * p_r * p_r + g_thth * p_th * p_th;
    float discriminant = B * B - 4.0 * A * C;
    float p_t = 0.0;
    if (discriminant >= 0.0) {
        float root1 = (-B + sqrt(discriminant)) / (2.0 * A);
        float root2 = (-B - sqrt(discriminant)) / (2.0 * A);
        p_t = (root1 > 0.0) ? root1 : root2;
    }

    E  = - g_tt * p_t - g_tph * p_ph;
    Lz =   g_tph * p_t + g_phph * p_ph;
    Q = p_ph * p_ph * Sigma * Sigma + cos2_th * ((Lz * Lz) / sin2_th - a2 * E * E);

    float r_cur = r;
    float th_cur = th;
    float ph_cur = ph;
    float p_r_cur = p_r;
    float p_th_cur = p_th;
    State Y = State(r_cur, th_cur, ph_cur, p_r_cur, p_th_cur);

    bool hit = false;
    bool fall = false;
    bool far = false;

    for(int i = 0; i < iSteps; i++) {
        State dY_dl = derivative(Y); // rk4Step(Y, iTimeStep);

/*
    u_r = sin(th_cur) * cos(ph_cur) * direction.x + sin(th_cur) * sin(ph_cur) * direction.y + cos(th_cur) * direction.z;
    u_th = cos(th_cur) * cos(ph_cur) * direction.x + cos(th_cur) * sin(ph_cur) * direction.y - sin(th_cur) * direction.z;
    u_ph = - sin(ph_cur) * direction.x + cos(ph_cur) * direction.y;
    u_th /= r_cur;
    u_ph /= sin(th) * r_cur;
    Y += vec3(u_r, u_th, u_ph) * iTimeStep;
*/
        int ingoing = 1;
        r_cur = Y.r + dY_dl.r * iTimeStep * ingoing;
        th_cur = Y.th + dY_dl.th * iTimeStep * ingoing;
        ph_cur = Y.ph + dY_dl.ph * iTimeStep * ingoing;
        p_r_cur = Y.p_r + dY_dl.p_r * iTimeStep * ingoing;
        p_th_cur = Y.p_th + dY_dl.p_th * iTimeStep * ingoing;
        Y = State(r_cur, th_cur, ph_cur, p_r_cur, p_th_cur);



        if(abs(degrees(th_cur) - 90.0) < 2.0 && r_cur > 1.5 * horizon && r_cur < 2.5 * horizon)
            hit = true;
        else if(r_cur < 1.05 * horizon)
            fall = true;
        else if(r_cur > 10.0)
            far = true;

        if(hit || fall || far)
            break;
    }



    float red = clamp(r_cur / r, 0.0, 1.0);
    float green = clamp(abs(degrees(th_cur) - 90.0) / 90.0, 0.0, 1.0);
    float blue = clamp(degrees(ph_cur) / 360.0 - floor(degrees(ph_cur) / 360.0), 0.0, 1.0);
    if (hit)
        red = 0.9, green = 0.9, blue = 0.5;
    if (fall)
        red = 0.0, green = 0.0, blue = 0.0;
    if (far)
        red = 0.1, green = 0.1, blue = 0.3;

    return vec3(red, green, blue);
}


void main() {
    vec4 clip = vec4((gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0, -1.0, 1.0);
    vec4 eye = vec4((inverse(iProjection) * clip).xy, -1.0, 0.0);
    vec3 direction = normalize((inverse(iView) * eye).xyz);
    vec3 position = iPosition;

    vec3 color = traceColor(position, direction);

    FragColor = vec4(color, 1.0);
}