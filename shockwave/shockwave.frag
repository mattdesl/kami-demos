#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_texture0;   // 0
uniform vec2 center;      // Mouse position, normalized 0.0 to 1.0
uniform float time;       // effect elapsed time
uniform vec3 shockParams;

varying vec2 vTexCoord0;
varying vec4 vColor;

void main() { 
    vec2 uv = vTexCoord0.xy;
    vec2 texCoord = uv;
    float dist = distance(uv, center);
    if ( (dist <= (time + shockParams.z)) && (dist >= (time - shockParams.z)) ) 
    {
        float diff = (dist - time); 
        float powDiff = 1.0 - pow(abs(diff*shockParams.x), shockParams.y); 
        float diffTime = diff  * powDiff; 
        vec2 diffUV = normalize(uv - center); 
        texCoord = uv + (diffUV * diffTime);
    }
    gl_FragColor = texture2D(u_texture0, texCoord) * vColor;
}
