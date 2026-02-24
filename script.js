window.addEventListener("DOMContentLoaded", ()=>{

const splash = document.getElementById("splash");
const app = document.getElementById("app");

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const overlayCtx = overlay.getContext("2d");

const processCanvas = document.getElementById("processCanvas");
const processCtx = processCanvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const countdownEl = document.getElementById("countdown");

/* mensaje stop */
const stopMessage = document.createElement("div");
stopMessage.innerText = "SCAN FINALIZADO";
stopMessage.style.position="absolute";
stopMessage.style.top="50%";
stopMessage.style.left="50%";
stopMessage.style.transform="translate(-50%,-50%)";
stopMessage.style.fontSize="38px";
stopMessage.style.fontWeight="bold";
stopMessage.style.opacity="0";
stopMessage.style.pointerEvents="none";
stopMessage.style.textShadow="0 0 20px red";
document.body.appendChild(stopMessage);

let scanning=false;
let previousFrame=null;
let shots=[];
let lastShotTime=0;
let countdownActive=false;

const FRAME_INTERVAL=300;
const CHANGE_THRESHOLD=35;
const PIXEL_CHANGE_REQUIRED=5000;
const MIN_TIME_BETWEEN_SHOTS=800;

/* SPLASH */

setTimeout(()=>{
splash.style.opacity="0";
setTimeout(()=>{
splash.style.display="none";
app.classList.remove("hidden");
},700);
},2000);

/* CAMERA */

navigator.mediaDevices.getUserMedia({
video:{facingMode:{ideal:"environment"}},
audio:false
})
.then(stream=>{
video.srcObject=stream;
})
.catch(()=>{
alert("Activa permisos de cámara");
});

/* RESIZE */

function resizeCanvas(){
overlay.width = video.clientWidth;
overlay.height = video.clientHeight;
}
video.addEventListener("loadedmetadata", resizeCanvas);
window.addEventListener("resize", resizeCanvas);

/* COUNTDOWN */

async function startCountdown(){

countdownActive=true;

for(let i=3;i>0;i--){

countdownEl.innerText=i;
countdownEl.style.opacity=1;

await new Promise(r=>setTimeout(r,1000));

if(!countdownActive) return;
}

countdownEl.style.opacity=0;

scanning=true;
previousFrame=null;
countdownActive=false;

}

/* STOP ANIMATION */

function showStopMessage(){

stopMessage.style.transition="none";
stopMessage.style.opacity="1";

setTimeout(()=>{
stopMessage.style.transition="1s";
stopMessage.style.opacity="0";
},1200);

}

/* BUTTONS */

startBtn.onclick=()=>{
if(scanning || countdownActive) return;
startCountdown();
};

stopBtn.onclick=()=>{
scanning=false;
countdownActive=false;
countdownEl.style.opacity=0;
showStopMessage();
};

/* TAP TEST MODE */

overlay.addEventListener("click",(e)=>{

if(!scanning) return;

const rect = overlay.getBoundingClientRect();

registerShot(
e.clientX - rect.left,
e.clientY - rect.top
);

});

/* DETECTION LOOP */

setInterval(()=>{

if(!scanning) return;
if(video.readyState!==4) return;

processCanvas.width=320;
processCanvas.height=240;

processCtx.drawImage(video,0,0,320,240);

const frame=processCtx.getImageData(0,0,320,240);

if(previousFrame){

let diffCount=0;

for(let i=0;i<frame.data.length;i+=4){

let diff=Math.abs(frame.data[i]-previousFrame.data[i]);

if(diff>CHANGE_THRESHOLD) diffCount++;

}

let now=Date.now();

if(diffCount>PIXEL_CHANGE_REQUIRED && now-lastShotTime>MIN_TIME_BETWEEN_SHOTS){

registerShot(
Math.random()*overlay.width,
Math.random()*overlay.height
);

lastShotTime=now;

}

}

previousFrame=frame;

},FRAME_INTERVAL);

/* SHOT SYSTEM */

function registerShot(x,y){

shots.forEach(s=>s.color="blue");

shots.push({
x,
y,
color:"red"
});

drawShots();

}

function drawShots(){

overlayCtx.clearRect(0,0,overlay.width,overlay.height);

shots.forEach(s=>{

overlayCtx.beginPath();
overlayCtx.arc(s.x,s.y,10,0,Math.PI*2);

overlayCtx.shadowBlur=18;
overlayCtx.shadowColor=s.color;

overlayCtx.fillStyle=s.color;
overlayCtx.fill();

overlayCtx.shadowBlur=0;

});

}

});
