precision mediump float;

uniform sampler2D u_texture0;
uniform sampler2D u_texture1;
uniform vec2 resolution;
uniform vec2 bgOffset;

varying vec2 vTexCoord0;

varying vec4 vColor;

void main() 
{        
	vec2 vTexCoord1 = vec2((gl_FragCoord.xy + bgOffset.xy) / resolution.xy);
	vTexCoord1.y = 1.0 - vTexCoord1.y;

    vec4 blend = texture2D(u_texture1, vTexCoord1);
    vec4 base = texture2D(u_texture0, vTexCoord0); 
    gl_FragColor = min(base, blend);
}