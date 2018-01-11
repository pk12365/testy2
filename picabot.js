require("dotenv").config();
const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const fs = require("fs");
const google = require("googleapis");
const youtube = google.youtube("v3");

const bot = new Discord.Client();
const prefix = "$";
const botChannelName = "icwbot2";
var botChannel;
var fortunes = ["It is certain", "It is decidedly so", "Without a doubt", "Yes definitely", "You may rely of it", "As I see it, yes", "Most likely", "Outlook good", "Yes", "Signs point to yes", "Reply hazy try again", "Ask again later", "Better not tell you now", "Cannot predict now", "Concentrate and ask again", "Dont count on it", "My reply is no", "My sources say no", "Outlook not so good", "Very doubtful"];
var dispatcher;
const songQueue = new Map();
var currentSongIndex = 0;
var previousSongIndex = 0;
var shuffle = false;
var autoremove = false;

var commands = {
	"help": {
		"usage": "<command> | -a or --all",
		"description": "Gives you a list of commands you can use or details on specific command(s)",
		"process": function(message, args){
			var commandKeys = Object.keys(commands);
			if(args.length === 0){
				var commandList = "";
				for(var i = 0; i < commandKeys.length - 1; i++){
					commandList += `\`${commandKeys[i]}\`, `;
				}
				commandList += `and \`${commandKeys[commandKeys.length - 1]}\``;
			        message.author.send("```Music commands are: \n   play     (add your music in the queue) \n   pause    (pause the player) \n   resume   (resume your player) \n   skip     (for next song) \n   prev     (for previous song) \n   stop     (stop & clear your player) \n   queue    (check queue list) \n   song     (view now playing) \n   random   (playing random song) ```", {reply: message});
			} else{
				var helpList = "";
				if(args[0] === "-a" || args[0] === "--all"){
					for(var i = 0; i < commandKeys.length; i++){
						helpList += `\`!${commandKeys[i]} ${commands[commandKeys[i]].usage}\`: ${commands[commandKeys[i]].description}\n`;
					}
				} else{
					for(var i = 0; i < args.length; i++){
						try{
							helpList += `\`!${args[i]} ${commands[args[i]].usage}\`: ${commands[args[i]].description}\n`;
						} catch(e){
							helpList += `\`!${args[i]}\`: Not a command\n`;
						}
					}
				}
				message.channel.send(helpList, {reply: message});
			}
		}
	},
	"play": {
		"usage": "<query>",
		"description": "Searches for a youtube video to add to the song queue",
		"process": function(message, args){
			if(message.member.voiceChannel !== undefined){
				if(args.length > 0){
					var query = "";
					for(var i = 0; i < args.length - 1; i++){
						query += args[i] + " ";
					}
					query += " " + args[args.length - 1];
					var results = youtube.search.list({
						"key": process.env.GOOGLEAPIKEY,
						"q": query,
						"type": "video",
						"maxResults": "1",
						"part": "snippet"
					}, function(err, data){
						if(err){
							message.channel.send("There was an error searching for your song :cry:", {reply: message});
							console.log("Error: " + err);
						}
						if(data){
							if(data.items.length === 0){
								message.channel.send(`There were no results for \`${query}\``);
							} else{
								addSong(message, "https://www.youtube.com/watch?v=" + data.items[0].id.videoId);
							}
						}
					});
				} else{
					message.channel.send(`You can search for a youtube song with \`${prefix}yt <query>\``, {reply: message});
				}
			} else{
				message.channel.send("You can't hear my music if you're not in a voice channel :cry:", {reply: message});
			}
		}
	},
	"resume": {
        "usage": "",
        "description": "Resumes the current song",
        "process": function(message, args){
            if (serverQueue && !serverQueue.playing)
            {
                serverQueue.playing = true;
                serverQueue.connection.dispatcher.resume();
                return message.channel.send('▶ Resumed the music for you!');
            }
            return message.channel.send('There is nothing playing.');
    },
    "pause": {
        "usage": "",
        "description": "Pauses the current song",
        "process": function(message, args){
            if (serverQueue && serverQueue.playing)
            {
                serverQueue.playing = false;
                serverQueue.connection.dispatcher.pause();
                return message.channel.send('⏸ Paused the music for you!');
            }
            return message.channel.send('There is nothing playing.');
        }
    },
    "pause": {
        "usage": "",
        "description": "Pauses the current song",
        "process": function(message, args){
            if(message.member.voiceChannel !== undefined){
                if(serverQueue.songs.length > 0){
                    if(serverQueue.playing){
                        serverQueue.playing = false;
                        serverQueue.connection.dispatcher.pause();
                        message.channel.send("Song paused! :pause_button:", {reply: message});
                    } else{
                        message.channel.send("Song is already paused", {reply: message});
                    }
                }
            }
        }
    },
	"prev": {
		"usage": "<amount>",
		"description": "Skips back in the queue by a certain amount of songs",
		"process": function(message, args){
			if(message.member.voiceChannel !== undefined){
				if(serverQueue.length > 0){
					previousSongIndex = currentSongIndex;
					var amount = Number.parseInt(args[0]);
					if(Number.isInteger(amount)){
						currentSongIndex -= amount;
					} else{
						currentSongIndex--;
					}
					if(currentSongIndex < 0){
						currentSongIndex = 0;
					}
					dispatcher.end("prev");
				} else{
					message.channel.send("There are no more songs :sob:", {reply: message});
				}
			} else{
				message.channel.send("You can't hear my music if you're not in a voice channel :cry:", {reply: message});
			}
		}
	},
	"skip": {
		"usage": "<amount>",
		"description": "Skips ahead in the queue by a certain amount of songs",
		"process": function(message, args){
			if(message.member.voiceChannel !== undefined){
				if(serverQueue.length > 0){
					previousSongIndex = currentSongIndex;
					var amount = Number.parseInt(args[0]);
					if(Number.isInteger(amount)){
						currentSongIndex += amount;
					} else{
						currentSongIndex++;
					}
					if(currentSongIndex > serverQueue.length - 1){
						currentSongIndex = serverQueue.length - 1;
						//bot.user.setGame(currentSong.title);
						//Workaround since above wouldn't work
						bot.user.setPresence({ game: { name: "", type: 0 } });
						message.member.voiceChannel.leave();
						message.channel.send("Finished playing the song queue");
					}
					dispatcher.end("next");
				} else{
					message.channel.send("There are no more songs :sob:", {reply: message});
				}
			} else{
				message.channel.send("You can't hear my music if you're not in a voice channel :cry:", {reply: message});
			}
		}
	},
	"goto": {
		"usage": "<index>",
		"description": "Skips to a certain song in the queue by its index",
		"process": function(message, args){
			if(message.member.voiceChannel !== undefined){
				if(serverQueue.length > 0){
					var index = Number.parseInt(args[0]);
					if(Number.isInteger(index)){
						previousSongIndex = currentSongIndex;
						currentSongIndex = index - 1;
						if(currentSongIndex < 0){
							currentSongIndex = 0;
						} else if(currentSongIndex > serverQueue.length - 1){
							currentSongIndex = serverQueue.length - 1;
						}
						dispatcher.end("goto");
					} else{
						message.channel.send(`\`${args[0]}\` is an invalid index`, {reply: message});
					}
				} else{
					message.channel.send("There are no more songs :sob:", {reply: message});
				}
			} else{
				message.channel.send("You can't hear my music if you're not in a voice channel :cry:", {reply: message});
			}
		}
	},
	"random": {
		"usage": "",
		"description": "Chooses a random song from the queue to play.",
		"process": function(message, args){
			if(message.member.voiceChannel !== undefined){
				if(serverQueue.length > 0){
					currentSongIndex = Math.floor(Math.random() * serverQueue.length);
					dispatcher.end("random");
				} else{
					message.channel.send("There are no more songs :sob:", {reply: message});
				}
			} else{
				message.channel.send("You can't hear my music if you're not in a voice channel :cry:", {reply: message});
			}
		}
	},
	"stop": {
		"usage": "<index>",
		"description": "Clears the song queue or a specific song in the queue",
		"process": function(message, args){
			if(message.member.voiceChannel !== undefined){
				if(serverQueue.length === 0){
					message.channel.send("There are no songs to clear", {reply: message});
				} else if(args.length > 0){
					var index = Number.parseInt(args[0]);
					if(Number.isInteger(index)){
						message.channel.send(`\`${serverQueue[index - 1].title}\` has been removed from the song queue`, {reply: message});
						serverQueue.splice(index - 1, 1);
						if(index - 1 <= currentSongIndex){
							currentSongIndex--;
						}
					} else{
						message.channel.send(`\`${args[0]}\` is an invalid index`, {reply: message});
					}
				} else{
					dispatcher.end("clear");
					currentSongIndex = 0;
					serverQueue = [];
					//bot.user.setGame(currentSong.title);
					//Workaround since above wouldn't work
					bot.user.setPresence({ game: { name: "", type: 0 } });
					message.member.voiceChannel.leave();
					message.channel.send("The song queue has been cleared", {reply: message});
				}
			} else{
				message.channel.send("You can't hear my music if you're not in a voice channel :cry:", {reply: message});
			}
		}
	},
	"autoremove": {
		"usage": "",
		"description": "Toggles autoremoving songs of the song queue",
		"process": function(message, args){
			if(message.member.voiceChannel !== undefined){
				if(autoremove){
					autoremove = false;
					message.channel.send("Song autoremoval is now disabled", {reply: message});
				} else{
					autoremove = true;
					message.channel.send("Song autoremoval is now enabled", {reply: message});
				}
			} else{
				message.channel.send("You can't hear my music if you're not in a voice channel :cry:", {reply: message});
			}
		}
	},
	"song": {
		"usage": "",
		"description": "Gives you information about the currently playing song",
		"process": function(message, args){
			if(serverQueue.length > 0){
				message.channel.send(`The current song is \`${serverQueue[currentSongIndex].title}\` :musical_note:, added by ${serverQueue[currentSongIndex].user}`, {reply: message});
			} else{
				message.channel.send("No song is in the queue", {reply: message});
			}
		}
    },
	"queue": {
		"usage": "",
		"description": "Gives you a list of the songs currently in the queue",
		"process": function(message, args){
			if(serverQueue.length > 0){
				var songList = "";
				for(var i = 0; i < serverQueue.length; i++){
					if(i === currentSongIndex){
						songList += `__**\`${i + 1}. ${serverQueue[i].title}\`**__\n`;
					} else{
						songList += `\`${i + 1}. ${serverQueue[i].title}\`\n`;
					}
				}
				message.channel.send("The song queue currently has:\n" + songList, {reply: message});
			} else{
				message.channel.send("No song is in the queue", {reply: message});
			}
		}
	},
	"volume": {
		"usage": "/volume {volume %0-100}",
        "description": "Sets the bots volume.",
		"process": function(message, args){
			if (args[1] < 0 || args[1] > 100) {
                message.channel.send("Invalid Volume! Please provide a volume from 0 to 100.");
				return;
			}
			volume[message.guild.id] = Number(args[1]) / 100;
			server.dispatcher = connection.playStream(YTDL(video.url, { filter: "audioonly" }));
            var server = servers[message.guild.id];
            if (serverQueue.dispatcher) {
				serverQueue.volume = args[1];
				serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1]);
				message.channel.send(`Volume set: ${args[1]}%`);
			}
		}
	}
};
var addSong = function(message, url){
	ytdl.getInfo(url).then(function(info){
		var song = {};
		song.title = info.title;
		song.url = url;
		song.user = message.author.username;

		message.channel.send(song.title + " info retrieved successfully");

		const queueConstruct = {
			textChannel: message.channel,
			connection: null,
			songs: [],
			volume: 3,
			playing: true
		};

		message.channel.send("Queue construct created successfully.");

		songQueue.set(message.guild.id, queueConstruct);

		message.channel.send("songQueue set successfully");

		queueConstruct.songs.push(song);

		message.channel.send("queuecontrsuct pushed successfully.");

		message.channel.send(`I have added \`${info.title}\` to the song queue! :headphones:`, {reply: message});
		if(!bot.voiceConnections.exists("channel", message.member.voiceChannel)){
			message.member.voiceChannel.join().then(function(connection){
				playSong(message, connection);
			}).catch(console.log);
		}
	}).catch(function(err){
		message.channel.send(err);
		message.channel.send("Sorry I couldn't get info for that song :cry:", {reply: message});
	});
}

var playSong = function(message, connection){
	const serverQueue = songQueue.get(message.guild.id);
	if(shuffle){
		do {
			currentSongIndex = Math.floor(Math.random() * serverQueue.songs.length);
		} while(currentSongIndex === previousSongIndex);
	}
	var currentSong = serverQueue.songs[currentSongIndex];
	message.channel.send("currentsong defined correctly");
	var stream = ytdl(currentSong.url, {"filter": "audioonly"});
	message.channel.send("stream defined correctly");
	dispatcher = connection.playStream(stream);
	message.channel.send("dispatcher defined correctly");
	message.channel.send(`Now ${(shuffle) ? "randomly " : ""}playing \`${currentSong.title}\` :musical_note:, added by ${currentSong.user}`);
	//bot.user.setGame(currentSong.title);
	//Workaround since above wouldn't work
	dispatcher.player.on("warn", console.warn);
	dispatcher.on("warn", console.warn);
	dispatcher.on("error", console.error);
	dispatcher.once("end", function(reason){
		console.log("Song ended because: " + reason);
		if(reason === "user" || reason === "Stream is not generating quickly enough."){
			if(autoremove){
				serverQueue.splice(currentSongIndex, 1);
				if(serverQueue.length === 0){
					//bot.user.setGame(currentSong.title);
					//Workaround since above wouldn't work
					message.member.voiceChannel.leave();
				} else{
					setTimeout(function(){
						playSong(message, connection);
					}, 500);
				}
			} else{
				currentSongIndex++;
				if(currentSongIndex >= serverQueue.length && !shuffle){
					//bot.user.setGame(currentSong.title);
					//Workaround since above wouldn't work
					message.member.voiceChannel.leave();
					message.channel.send("Finished playing the song queue");
				} else{
					setTimeout(function(){
						playSong(message, connection);
					}, 500);
				}
			}
		} else if(reason === "prev" || reason === "next" || reason === "goto" || reason === "random"){
			setTimeout(function(){
				playSong(message, connection);
			}, 500);
		}
	});
}

var checkForCommand = function(message) {
  if (!message.author.bot && message.content.startsWith(prefix)) {
    var args = message.content.substring(1).split(' ');
    var command = args.splice(0, 1);
    try {
      commands[command].process(message, args);
    } catch (e) {
    }
  }
};

bot.on("ready", function(){
	console.log("Bot ready");
});
bot.on("disconnect", function(){
	console.log("Bot disconnected");
	process.exit(1);
});
bot.on("guildMemberAdd", function(member){
	member.guild.defaultChannel.send(`Welcome to the server, ${member}! :smile:`);
	member.guild.defaultChannel.send(`You can type \`${prefix}help\` at anytime to see my commands`);
});
bot.on("message", function(message){
	const serverQueue = songQueue.get(message.guild.id);
	checkForCommand(message);
});
bot.on("messageUpdate", function(oldMessage, newMessage){
	checkForCommand(newMessage);
});

bot.login(process.env.BOTTOKEN).then(function(){
	console.log("Bot logged in");
}).catch(console.log);

fs.readFile("save.json", function(err, data){
	if(err){
		if(err.code === "ENOENT"){
			console.log("save.json does not exist");
			fs.writeFile("save.json", "{}", "utf8", function(err){
				if(err) throw err;
				console.log("save.json created");
			});
		} else{
			throw err;
		}
	}
});
function newFunction() {
	return queue.message.guild.id;
}
