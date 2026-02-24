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

/* COUNTDOWN SYSTEM */

async function startCountdown(){

countdownActive=true;

for(let i=3;i>0;i--){

countdownEl.innerText=i;
countdownEl.style.opacity=1;
countdownEl.style.transform="translate(-50%,-50%) scale(1.2)";

await new Promise(r=>setTimeout(r,700));

countdownEl.style.transform="translate(-50%,-50%) scale(.8)";
await new Promise(r=>setTimeout(r,300));

if(!countdownActive) return;
}

countdownEl.style.opacity=0;

scanning=true;
previousFrame=null;
countdownActive=false;

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
};

/* DETECTION */

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

registerShot();
lastShotTime=now;

}

}

previousFrame=frame;

},FRAME_INTERVAL);

/* SHOTS */

function registerShot(){

overlay.width=video.clientWidth;
overlay.height=video.clientHeight;

shots.forEach(s=>s.color="blue");

shots.push({
x:Math.random()*overlay.width,
y:Math.random()*overlay.height,
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
