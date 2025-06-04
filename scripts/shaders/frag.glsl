in vec2 v_UV;

uniform vec3 u_clear_color;

uniform float u_threshold;
uniform float u_max_distance;
uniform int u_max_steps;

uniform vec3 u_camera_position;
uniform mat4 u_camera_to_world_mat;
uniform mat4 u_camera_inverse_proj_mat;

uniform vec3 u_light_direction;
uniform vec3 u_light_color;

uniform float u_diffuse_intensity;
uniform float u_spectral_intensity;
uniform float u_ambient_intensity;
uniform float u_shininess;

uniform float u_time;

float sd_sphere(vec3 p, float r)
{
    return length(p) - r;
}

// sigmoid
float smin(float a, float b, float k)
{
    k *= log(2.0);
    float x = b - a;
    return a + x / (1.0 - exp2(x / k));
}

float scene(vec3 p)
{
    float d1 = sd_sphere(p, 1.0);

    p.x += 4.0;
    float d2 = sd_sphere(p, 1.0);

    p.x += cos(u_time) * 2.0;
    p.z += sin(u_time) * 1.5;
    float d3 = sd_sphere(p, 1.0);

    float minimum = min(d1, d2);
    return min(minimum, d3);
    // float minimum = smin(d1, d2, 0.25);
    // minimum = smin(minimum, d3, 0.25);
    // return minimum;
}

float mandelbulb_sdf(vec3 p, float power)
{
    vec3 z = p;
    float dr = 1.0;
    float r;

    for (int i = 0; i < 15; i++) {
        r = length(z);
        if (r > 2.0) break;

        float theta = acos(z.z / r) * power;
        float phi = atan(z.y, z.x) * power;
        float zr = pow(r, power);
        dr = pow(r, power - 1.0) * power * dr + 1.0;

        z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
        z += p;
    }

    return 0.5 * log(r) * r / dr;
}

float mandelbulb_sdf_2( in vec3 p)
{
    vec3 w = p;
    float m = dot(w,w);

    // vec4 trap = vec4(abs(w),m);
	float dz = 1.0;
    
	for( int i=0; i<4; i++ )
    {
        // trigonometric version (MUCH faster than polynomial)
        
        // dz = 8*z^7*dz
		dz = 8.0*pow(m,3.5)*dz + 1.0;
      
        // z = z^8+c
        float r = length(w);
        float b = 8.0*acos( w.y/r);
        float a = 8.0*atan( w.x, w.z );
        w = p + pow(r,8.0) * vec3( sin(b)*sin(a), cos(b), sin(b)*cos(a) );

        m = dot(w,w);
		if( m > 256.0 )
            break;
    }

    // resColor = vec4(m,trap.yzw);

    // distance estimation (through the Hubbard-Douady potential)
    return 0.25 * log(m) * sqrt(m) / dz;
}

vec2 march_ray(vec3 origin, vec3 direction)
{
    float ray_distance = 0.0;
    float scene_distance;
    vec3 ray_position;
    
    int iterations = 0;
    for (iterations; iterations < u_max_steps; iterations++) {
        // calculate new raymarch point
        ray_position = origin + ray_distance * direction;

        // get the distance from the scene to the raymarch
        // scene_distance = scene(ray_position);
        // scene_distance = mandelbulb_sdf(ray_position, 8.0);
        scene_distance = mandelbulb_sdf_2(ray_position);

        // check if the ray is out of bounds or collided
        if (scene_distance < u_threshold || scene_distance >= u_max_distance) break;

        ray_distance += scene_distance;
    } 

    return vec2(ray_distance, iterations);
}

// vec3 get_normal(vec3 p)
// {
//     vec3 normal = vec3(0,0,0);
//     vec3 e;

//     for (int i = 0; i < 4; i++) {
//         // no fucking clue whats happening here
//         e = 0.5773 * (2.0 * vec3((((i+3) >> 1) & 1), ((i >> 1) & 1), (i & 1)) - 1.0);
//         normal += e * mandelbulb_sdf(p + e * u_threshold);
//     }

//     return normalize(normal);
// }

void main()
{
    // fetch uv coordinates
    vec2 uv = v_UV.xy;

    // calculate origin and direction for raycasting
    vec3 ray_origin = u_camera_position;
    vec3 ray_direction = (u_camera_inverse_proj_mat * vec4(uv*2.0-1.0, 0, 1)).xyz;
    ray_direction = (u_camera_to_world_mat * vec4(ray_direction, 0)).xyz;
    ray_direction = normalize(ray_direction);

    // get raymarch value
    vec2 ray_data = march_ray(ray_origin, ray_direction);
    float distance = ray_data.x;

    // check if the ray hit anything
    vec3 color;
    if (distance >= u_max_distance) {
        color = vec3(u_clear_color);
    } else {
        // vec3 hit_position = ray_origin + distance * ray_direction;
        // vec3 normal = get_normal(hit_position);

        // float dot_normal_light = dot(normal, u_light_direction);
        // float diffuse = max(dot_normal_light, 0.0) * u_diffuse_intensity;
        // float spectral = pow(diffuse, u_shininess) * u_spectral_intensity;
        // float ambient = u_ambient_intensity;

        // color = u_light_color * (vec3(1.0, 1.0, 1.0) * (diffuse + spectral + ambient));
        color += vec3(ray_data.y / 100.0);
    }

    gl_FragColor = vec4(color, 1.0);
}