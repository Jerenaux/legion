precision mediump float;
uniform sampler2D uMainSampler;
varying vec2 outTexCoord;

void main(void) {
    vec4 color = texture2D(uMainSampler, outTexCoord);
    float average = (color.r + color.g + color.b) / 3.0;
    gl_FragColor = vec4(average, average, average, color.a);
}