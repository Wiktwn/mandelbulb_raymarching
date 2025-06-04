out vec2 v_UV;

void main ()
{
    // compute view direction
    vec4 world_position = modelViewMatrix * vec4(position, 1.0);
    vec3 view_direction = normalize(-world_position.xyz);

    // output vertex position
    gl_Position = projectionMatrix * world_position;

    v_UV = uv;
}
