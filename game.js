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
	this.width = 40;
	this.height = 30;

	this.alive = true;
	this.direction = 0;
	this.speed = 1;
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
}

Car.prototype.turn = function(val){
	this.direction = (this.direction + val) % 360;
}

Car.prototype.update = function(fx, fy){
	this.x += this.speed * Math.cos((this.direction / 180) * Math.PI);
	this.y += this.speed * Math.sin((this.direction / 180) * Math.PI);
	//Update score with position to the finish line
	this.score = 600 - Math.sqrt(Math.pow((this.x - fx), 2) + Math.pow((this.y - fy), 2));
}

Car.prototype.isDead = function(height, width, obstacles, fx, fy){
	// Die if you go outside the canvas
	if(this.y >= height || this.y + this.height <= 0){
		return true;
	}
	if(this.x >= width || this.x + this.width <= 0){
		return true;
	}
	//Die if you hit an obstacle
	for(var i in obstacles){
		if(Math.abs(this.x - obstacles[i].x) < 10 && Math.abs(this.y - obstacles[i].y) < 10){
			return true;
		}
	}
	//Die if you hit the finish line : for training purposes
	if(Math.abs(this.x - fx) < 10 && Math.abs(this.y - fy) < 10){
		return true;
	}
}

var Obstacle = function(json){
	this.x = 300;
	this.y = 300;
	this.width = 20;
	this.height = 20;

	this.init(json);
}

Obstacle.prototype.init = function(json){
	for(var i in json){
		this[i] = json[i];
	}
}

var Game = function(){
	this.cars = [];
	this.obstacles = [];
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
	this.finishLineX = 0;
	this.finishLineY = 0;
	//obstacles
	for(var i = 0; i < 2; i++){
		var o = new Obstacle();
		o.x = Math.random() * this.width;
		o.y = Math.random() * this.height;
		this.obstacles.push(o);
	}
	//init finish Line
	this.finishLineX = this.width / 2;
	this.finishLineY = this.height / 3;
}

Game.prototype.start = function(){
	this.interval = 0;
	this.cars = [];
	this.currentMaxScore = 0;
	this.gen = Neuvol.nextGeneration();
	for(var i in this.gen){
		var c = new Car();
		this.cars.push(c);
	}

	this.generation++;
	this.alives = this.cars.length;
}

Game.prototype.update = function(){


	for(var i in this.cars){
		if(this.cars[i].alive){

			var inputs = [
				this.cars[i].x,
				this.cars[i].y
			];

			//NN tells whether accelerate, brake
			// res returns a float number: if >0.5 accelerate, if <0.5 brake
			var res = this.gen[i].compute(inputs);
			if(res[0] > 0.5){
				this.cars[i].accelerate(1);
			} else {
				this.cars[i].accelerate(0);
			}
			if(res[1] < 0.33){
				this.cars[i].turn(1);
			} else if (res[1] < 0.66) {
				this.cars[i].turn(0);
			} else {
				this.cars[i].turn(-1);
			}

			this.cars[i].update(this.finishLineX, this.finishLineY);
			this.currentMaxScore = (this.cars[i].score > this.currentMaxScore) ? this.cars[i].score : this.currentMaxScore;

			if(this.cars[i].isDead(this.height, this.width, this.obstacles, this.finishLineX, this.finishLineY)){
				this.cars[i].alive = false;
				this.alives--;
				console.log(i, this.cars[i].score);
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

	this.ctx.fillStyle = "#D3D3D3";

	//Playground
	this.ctx.fillRect(0, 0, this.width, this.height);

	//Obstacles
	this.ctx.fillStyle = "#ff2000";
	for(var i in this.obstacles){
		this.ctx.fillRect(this.obstacles[i].x, this.obstacles[i].y, 10, 10);
	}

	//Finish Line
	this.ctx.fillStyle = "#ff0000";
	this.ctx.fillRect(this.finishLineX - 20 , this.finishLineY - 20, 20, 20);

	//Cars
	for(var i in this.cars){
		if(this.cars[i].alive){
			this.ctx.save();
			this.ctx.translate(this.cars[i].x + this.cars[i].width/2, this.cars[i].y + this.cars[i].height/2);
			this.ctx.rotate(this.cars[i].direction * Math.PI / 180);
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
