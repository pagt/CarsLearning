(function() {
	var timeouts = [];
	var messageName = "zero-timeout-message";

	function setZeroTimeout(fn) {
		timeouts.push(fn);
		window.postMessage(messageName, "*");
	}

	function handleMessage(event) {
		if (event.source == window && event.data == messageName) {
			event.stopPropagation();
			if (timeouts.length > 0) {
				var fn = timeouts.shift();
				fn();
			}
		}
	}

	window.addEventListener("message", handleMessage, true);

	window.setZeroTimeout = setZeroTimeout;
})();

var Neuvol;
var game;
var FPS = 60;
var maxScore=0;

var images = {};

var speed = function(fps){
	FPS = parseInt(fps);
}

var loadImages = function(sources, callback){
	var nb = 0;
	var loaded = 0;
	var imgs = {};
	for(var i in sources){
		nb++;
		imgs[i] = new Image();
		imgs[i].src = sources[i];
		imgs[i].onload = function(){
			loaded++;
			if(loaded == nb){
				callback(imgs);
			}
		}
	}
}

var Car = function(json){
	this.x = 0;
	this.y = 0;
	this.width = 30;
	this.height = 40;

	this.alive = true;
	this.direction = 0;
	this.speed = 0;
	this.score = 0;

	this.init(json);
}

Car.prototype.init = function(json){
	for(var i in json){
		this[i] = json[i];
	}
}

Car.prototype.accelerate = function(val){
	this.speed += val;
	// you get incentive when you move forward
	if (val > 0) {
		this.score += 1;
	}
}

Car.prototype.turn = function(val){
	this.direction += val;
}

Car.prototype.update = function(){
	this.y += this.speed;
	// fake direction
	this.x += this.direction;
}

Car.prototype.isDead = function(height, width){
	// Die if you go outside the canvas
	if(this.y >= height || this.y + this.height <= 0){
		return true;
	}
	if(this.x >= width || this.x + this.width <= 0){
		return true;
	}
}


var Game = function(){
	this.cars = [];
	this.canvas = document.querySelector("#playground");
	this.ctx = this.canvas.getContext("2d");
	this.width = this.canvas.width;
	this.height = this.canvas.height;
	this.spawnInterval = 90;
	this.interval = 0;
	this.gen = [];
	this.alives = 0;
	this.generation = 0;
	this.backgroundSpeed = 0.5;
	this.backgroundx = 0;
	this.maxScore = 0;
	this.currentMaxScore = 0;
}

Game.prototype.start = function(){
	this.interval = 0;
	this.cars = [];
	this.currentMaxScore = 0;
	this.gen = Neuvol.nextGeneration();
	for(var i in this.gen){
		var c = new Car();
		this.cars.push(c)
	}
	this.generation++;
	this.alives = this.cars.length;
}

Game.prototype.update = function(){


	for(var i in this.cars){
		if(this.cars[i].alive){

			var inputs = [
			this.cars[i].y
			];

			//NN tells whether accelerate, brake
			// res returns a float number: if >0.5 accelerate, if <0.5 brake
			var res = this.gen[i].compute(inputs);
			if(res[0] > 0.5){
				this.cars[i].accelerate(1);
			} else {
				this.cars[i].accelerate(-1);
			}
			if(res[1] > 0.5){
				this.cars[i].turn(1);
			} else {
				this.cars[i].turn(-1);
			}

			this.cars[i].update();
			this.currentMaxScore = (this.cars[i].score > this.currentMaxScore) ? this.cars[i].score : this.currentMaxScore;

			if(this.cars[i].isDead(this.height, this.width)){
				this.cars[i].alive = false;
				this.alives--;
				//console.log(this.alives);
				Neuvol.networkScore(this.gen[i], this.cars[i].score);
				this.maxScore = (this.cars[i].score > this.maxScore) ? this.cars[i].score : this.maxScore;
				if(this.isItEnd()){
					this.start();
				}
			}
		}
	}

	var self = this;

	if(FPS == 0){
		setZeroTimeout(function(){
			self.update();
		});
	}else{
		setTimeout(function(){
			self.update();
		}, 1000/FPS);
	}
}


Game.prototype.isItEnd = function(){
	for(var i in this.cars){
		if(this.cars[i].alive){
			return false;
		}
	}
	return true;
}

Game.prototype.display = function(){
	this.ctx.clearRect(0, 0, this.width, this.height);
	for(var i = 0; i < Math.ceil(this.width / images.background.width) + 1; i++){
		this.ctx.drawImage(images.background, i * images.background.width - Math.floor(this.backgroundx%images.background.width), 0)
	}


	this.ctx.fillStyle = "#FFC600";
	this.ctx.strokeStyle = "#CE9E00";
	for(var i in this.cars){
		if(this.cars[i].alive){
			this.ctx.save();
			this.ctx.translate(this.cars[i].x + this.cars[i].width/2, this.cars[i].y + this.cars[i].height/2);
			this.ctx.drawImage(images.bird, -this.cars[i].width/2, -this.cars[i].height/2, this.cars[i].width, this.cars[i].height);
			this.ctx.restore();
		}
	}

	this.ctx.fillStyle = "white";
	this.ctx.font="20px Oswald, sans-serif";
	this.ctx.fillText("Score : "+ this.currentMaxScore, 10, 25);
	this.ctx.fillText("Max Score : "+this.maxScore, 10, 50);
	this.ctx.fillText("Generation : "+this.generation, 10, 75);
	this.ctx.fillText("Alive : "+this.alives+" / "+Neuvol.options.population, 10, 100);

	var self = this;
	requestAnimationFrame(function(){
		self.display();
	});
}

window.onload = function(){
	var sprites = {
		bird:"./img/bird.png",
		background:"./img/background.png",
		pipetop:"./img/pipetop.png",
		pipebottom:"./img/pipebottom.png"
	}

	var start = function(){
		Neuvol = new Neuroevolution({
			population:10,
			network:[2, [2], 2],
		});
		game = new Game();
		game.start();
		game.update();
		game.display();
	}


	loadImages(sprites, function(imgs){
		images = imgs;
		start();
	})

}
