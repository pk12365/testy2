require("dotenv").config();
const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const fs = require("fs");
const google = require("googleapis");
const youtube = google.youtube("v3");
//var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const bot = new Discord.Client();
const prefix = ".";
const botChannelName = "icwbot2";
var botChannel;
var fortunes = ["It is certain", "It is decidedly so", "Without a doubt", "Yes definitely", "You may rely of it", "As I see it, yes", "Most likely", "Outlook good", "Yes", "Signs point to yes", "Reply hazy try again", "Ask again later", "Better not tell you now", "Cannot predict now", "Concentrate and ask again", "Dont count on it", "My reply is no", "My sources say no", "Outlook not so good", "Very doubtful"];
var dispatcher;
const songQueue = new Map();
var currentSongIndex = 0;
var previousSongIndex = 0;
var shuffle = false;
var autoremove = false;

bot.on("ready", function() {
	console.log("Bot ready");
});
bot.on("disconnect", function() {
	console.log("Bot disconnected");
	process.exit(1);
});
bot.on("guildMemberAdd", function(member) {
	member.guild.defaultChannel.send(`Welcome to the server, ${member}! :smile:`);
	member.guild.defaultChannel.send(`You can type \`${prefix}help\` at anytime to see my commands`);
});

bot.on("messageUpdate", function(oldMessage, newMessage) {
	checkForCommand(newMessage);
});

bot.login(process.env.BOTTOKEN).then(function() {
	console.log("Bot logged in");
}).catch(console.log);
//bot.login(config.token);

fs.readFile("save.json", function(err, data) {
	if (err) {
		if (err.code === "ENOENT") {
			console.log("save.json does not exist");
			fs.writeFile("save.json", "{}", "utf8", function(err) {
				if (err) throw err;
				console.log("save.json created");
			});
		} else {
			throw err;
		}
	}
});

bot.on("message", function(message) {
	const serverQueue = songQueue.get(message.guild.id);

	if (message.author.bot) return undefined;

	if (!message.content.startsWith(prefix)) return undefined;

	const args = message.content.substring(1).split(' ');
	//Get command from message
	let command = message.content.toLowerCase().split(" ")[0];
	//Remove prefix from command string
	command = command.slice(prefix.length);

	if (command === "help") {
		message.author.send("```Music commands are: \n   play     (add your music in the queue) \n   pause    (pause the player) \n   resume   (resume your player) \n   skip     (for next song) \n   prev     (for previous song) \n   stop     (stop & clear your player) \n   queue    (check queue list) \n   song     (view now playing) \n   random   (playing random song) ```", {reply: message});
	}

	if (command === "play") {
		if (message.member.voiceChannel !== undefined) {
			if (args.length > 0) {
				var query = "";
				for (var i = 0; i < args.length - 1; i++) {
					query += args[i] + " ";
				}
				query += " " + args[args.length - 1];
				var results = youtube.search.list({
					"key": process.env.GOOGLEAPIKEY,
					"q": query,
					"type": "video",
					"maxResults": "1",
					"part": "snippet"
				}, function(err, data) {
					if (err) {
						message.channel.send("There was an error searching for your song :cry:", { reply: message });
						console.log("Error: " + err);
					}
					if (data) {
						if (data.items.length === 0) {
							message.channel.send(`There were no results for \`${query}\``);
						} else {
							addSong(message, "https://www.youtube.com/watch?v=" + data.items[0].id.videoId);
						}
					}
				});
			} else {
				message.channel.send(`You can search for a youtube song with \`${prefix}yt <query>\``, { reply: message });
			}
		} else {
			message.channel.send("You can't hear my music if you're not in a voice channel :cry:", { reply: message });
		}
	}

	if (command === "resume") {
		if (message.member.voiceChannel !== undefined) {
			if (serverQueue && !serverQueue.playing) {
				serverQueue.playing = true;
				dispatcher.resume();
				return message.channel.send('▶ Resumed the music for you!');
			}
			return message.channel.send('There is nothing playing.');
		} else {
			message.channel.send("You can't resume music if you're not in a voice channel :cry:", { reply: message });
		}
	}

	if (command === "pause") {
		if (message.member.voiceChannel !== undefined) {
			if (serverQueue && serverQueue.playing) {
				serverQueue.playing = false;
				dispatcher.pause();
				return message.channel.send('⏸ Paused the music for you!');
			}
			return message.channel.send('There is nothing playing.');
		} else {
			message.channel.send("You can't pause music if you're not in a voice channel :cry:", { reply: message });
		}
	}

	if (command === "prev") {
		if (message.member.voiceChannel !== undefined) {
			previousSongIndex = currentSongIndex;
			var amount = Number.parseInt(args[0]);
			if (Number.isInteger(amount)) {
				currentSongIndex -= amount;
			} else {
				currentSongIndex--;
			}
			if (currentSongIndex < 0) {
				currentSongIndex = 0;
			}
			dispatcher.end("prev");
		} else {
			message.channel.send("You can't prev music if you're not in a voice channel :cry:", { reply: message });
		}
	}


	if (command === "skip") {
		if (message.member.voiceChannel !== undefined) {
			if (serverQueue.songs.length > 0) {
				previousSongIndex = currentSongIndex;
				var amount = Number.parseInt(args[0]);
				if (Number.isInteger(amount)) {
					currentSongIndex += amount;
				} else {
					currentSongIndex++;
				}
				if (currentSongIndex > serverQueue.songs.length - 1) {
					currentSongIndex = serverQueue.songs.length - 1;
					//bot.user.setGame(currentSong.title);
					//Workaround since above wouldn't work
					bot.user.setPresence({ game: { name: "", type: 0 } });
					serverQueue.songs = [];
					currentSongIndex = 0;
					message.member.voiceChannel.leave();
					message.channel.send("Finished playing the song queue");
				}
				dispatcher.end("next");
			} else {
				message.channel.send("There are no more songs :sob:", { reply: message });
			}
		} else {
			message.channel.send("You can't hear my music if you're not in a voice channel :cry:", { reply: message });
		}
	}

	if (command === "goto") {
		if (message.member.voiceChannel !== undefined) {
			var index = Number.parseInt(args[0]);
			if (Number.isInteger(index)) {
				previousSongIndex = currentSongIndex;
				currentSongIndex = index - 1;
				if (currentSongIndex < 0) {
					currentSongIndex = 0;
				} else if (currentSongIndex > serverQueue.length - 1) {
					currentSongIndex = serverQueue.length - 1;
				}
				dispatcher.end("goto");
			} else {
				message.channel.send(`\`${args[0]}\` is an invalid index`, { reply: message });
			}
		} else {
			message.channel.send("You can't hear my music if you're not in a voice channel :cry:", { reply: message });
		}
	}

	if (command === "random") {
		if (message.member.voiceChannel !== undefined) {
			if (serverQueue.songs.length > 0) {
				currentSongIndex = Math.floor(Math.random() * serverQueue.songs.length);
				dispatcher.end("random");
			} else {
				message.channel.send("There are no more songs :sob:", { reply: message });
			}
		} else {
			message.channel.send("You can't hear my music if you're not in a voice channel :cry:", { reply: message });
		}
	}

	if (command === "stop") {
		if (message.member.voiceChannel !== undefined) {
			if (!message.guild.me.voiceChannel) {
				message.channel.send("bot is not in voice channel and nothing to play", { reply: message });
					return;
			}
				if (serverQueue.songs.length === 0) {
					message.channel.send("There are no songs to clear", { reply: message });
				} else {
					dispatcher.end("stopping");
					currentSongIndex = 0;
					serverQueue.songs = [];
					message.member.voiceChannel.leave();
					message.channel.send("Clearing queue and stopping music!");
				}
				/*else if(args.length > 0){
					var index = Number.parseInt(args[0]);
					if(Number.isInteger(index)){
						message.channel.send(`\`${serverQueue[index - 1].title}\` has been removed from the song queue`, {reply: message});
						serverQueue.songs.splice(index - 1, 1);
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
					bot.user.setPresence({ game: { name: serverQueue.songs[0].title, type: 0 } });
					message.member.voiceChannel.leave();
					message.channel.send("The song queue has been cleared", {reply: message});
				}*/
		} else {
			message.channel.send("You can't stop music if you're not in a voice channel :cry:", {reply: message});
		}
	}

	if (command === "autoremove") {
		if (message.member.voiceChannel !== undefined) {
			if (autoremove) {
				autoremove = false;
				message.channel.send("Song autoremoval is now disabled", { reply: message });
			} else {
				autoremove = true;
				message.channel.send("Song autoremoval is now enabled", { reply: message });
			}
		} else {
			message.channel.send("You can't hear my music if you're not in a voice channel :cry:", { reply: message });
		}
	}

	if (command === "song") {
		if (serverQueue.songs.length > 0) {
			message.channel.send(`The current song is \`${serverQueue.songs[currentSongIndex].title}\` :musical_note:, added by ${serverQueue.songs[currentSongIndex].user}`, { reply: message });
		} else {
			message.channel.send("No song is in the queue", { reply: message });
		}
	}

	if (command === "queue") {
		if (serverQueue.songs.length > 0) {
			var songList = "";
			for (var i = 0; i < serverQueue.songs.length; i++) {
				if (i === currentSongIndex) {
					songList += `__**\`${i + 1}. ${serverQueue.songs[i].title}\`**__\n`;
				} else {
					songList += `\`${i + 1}. ${serverQueue.songs[i].title}\`\n`;
				}
			}
			message.channel.send("The song queue currently has:\n" + songList, { reply: message });
		} else {
			message.channel.send("No song is in the queue", { reply: message });
		}
	}

	if (command === "volume") {
		if (message.member.voiceChannel !== undefined) {
			if (!message.guild.me.voiceChannel) {
				message.channel.send("bot is not in voice channel", { reply: message });
					return;
			}
				if (args[1] > 100) {
					message.channel.send("Invalid Volume! Please provide a volume from 1 to 100.");
					return;
				}
					if (args[1] < 1) {
						message.channel.send("Invalid Volume! Please provide a volume from 1 to 100.");
						return;
					}
				serverQueue.volume[message.guild.id] = args[1];
				dispatcher.setVolumeLogarithmic(args[1] / 80);
				var setvolembed = new Discord.RichEmbed()
					.setTitle("volume controls")
					.setDescription(`volume set ${args[1]}%`)
					.setThumbnail("https://images-ext-1.discordapp.net/external/v1EV83IWPZ5tg7b5NJwfZO_drseYr7lSlVjCJ_-PncM/https/cdn.discordapp.com/icons/268683615632621568/168a880bdbc1cb0b0858f969b2247aa3.jpg?width=80&height=80")
					.setFooter("Changed by: " + message.author.username.toString(), message.author.avatarURL);
				message.channel.send({embed: setvolembed});
				//}
		} else {
			message.channel.send("you cant change volume if you are not in voice channel", { reply: message});
		}
	}
});

var addSong = function(message, url) {
	const serverQueue = songQueue.get(message.guild.id);
	ytdl.getInfo(url).then(function(info) {
		var song = {};
		song.title = info.title;
		song.url = url;
		song.user = message.author.username;
		song.usravatar = message.author.avatarURL;

		//message.channel.send(song.title + " info retrieved successfully");
		if (!serverQueue) {
			const queueConstruct = {
				textChannel: message.channel,
				connection: null,
				songs: [],
				volume: [],
				playing: true
			};

			//message.channel.send("Queue construct created successfully.");

			songQueue.set(message.guild.id, queueConstruct);

			//message.channel.send("songQueue set successfully");

			queueConstruct.songs.push(song);
		}
		//message.channel.send("queuecontrsuct pushed successfully.");
		else {
			message.channel.send(`I have added \`${info.title}\` to the song queue! :headphones: ${url}`, { reply: message });

			serverQueue.songs.push(song);
		}
		if (!bot.voiceConnections.exists("channel", message.member.voiceChannel)) {
			message.member.voiceChannel.join().then(function(connection) {
				playSong(message, connection);
			}).catch(console.log);
		}
	}).catch(function(err) {
		message.channel.send(err + "\n\n\n");
		message.channel.send("Sorry I couldn't get info for that song :cry:", { reply: message });
	});
};

var playSong = function(message, connection) {
	const serverQueue = songQueue.get(message.guild.id);
	if (shuffle) {
		do {
			currentSongIndex = Math.floor(Math.random() * serverQueue.songs.length);
		} while (currentSongIndex === previousSongIndex);
	}

	var currentSong = serverQueue.songs[currentSongIndex];
	if (currentSong) {
		//message.channel.send("currentsong defined correctly");
		var stream = ytdl(currentSong.url, { "filter": "audioonly" });
		//message.channel.send("stream defined correctly");
		dispatcher = connection.playStream(stream, { volume: serverQueue.volume[message.guild.id] / 80});
		//message.channel.send("dispatcher defined correctly");
		var nowplayembed = new Discord.RichEmbed()
		.setAuthor(`Now ${(shuffle) ? "randomly " : ""}playing \`${currentSong.title}\` :musical_note:`)
		.setDescription("link here" + currentSong.url)
		.setURL(`${currentSong.url}`)
		.setThumbnail("https://images-ext-1.discordapp.net/external/v1EV83IWPZ5tg7b5NJwfZO_drseYr7lSlVjCJ_-PncM/https/cdn.discordapp.com/icons/268683615632621568/168a880bdbc1cb0b0858f969b2247aa3.jpg?width=80&height=80")
		.setFooter("Added by: " + `${currentSong.user}`, currentSong.usravatar)
		.setTimestamp();
		message.channel.send({embed: nowplayembed});
		//bot.user.setGame(currentSong.title);
		//Workaround since above wouldn't work
		dispatcher.player.on("warn", console.warn);
		dispatcher.on("warn", console.warn);
		dispatcher.on("error", console.error);
		dispatcher.once("end", function(reason) {
			console.log("Song ended because: " + reason);
			if (reason === "user" || reason === "Stream is not generating quickly enough.") {
				if (autoremove) {
					serverQueue.splice(currentSongIndex, 1);
					if (serverQueue.songs.length === 0) {
						//bot.user.setGame(currentSong.title);
						//Workaround since above wouldn't work
						message.member.voiceChannel.leave();
					} else {
						setTimeout(function() {
							playSong(message, connection);
						}, 500);
					}
				} else {
					currentSongIndex++;
					if (currentSongIndex >= serverQueue.songs.length && !shuffle) {
						//bot.user.setGame(currentSong.title);
						//Workaround since above wouldn't work
						message.member.voiceChannel.leave();
						message.channel.send("Finished playing the song queue");
					} else {
						setTimeout(function() {
							playSong(message, connection);
						}, 500);
					}
				}
			} else if (reason === "prev" || reason === "next" || reason === "goto" || reason === "random") {
				setTimeout(function() {
					playSong(message, connection);
				}, 500);
			}
		});
	}
};

var checkForCommand = function(message) {
	if (!message.author.bot && message.content.startsWith(prefix)) {
		var args = message.content.substring(1).split(' ');
		var command = args.splice(0, 1);
		try {
			commands[command].process(message, args);
		} catch (e) {}
	}
};


function newFunction() {
	return queue.message.guild.id;
}
