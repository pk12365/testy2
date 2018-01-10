
const Discord = module.require("discord.js");

module.exports.run = async (bot, message, args, queue, conf) => {
    try{
        const dispatcher = bot.voiceConnections.get(message.guild.id).dispatcher;
        volume = parseFloat(args[0]);
        volume = volume / 100
        if(volume > 1){
            volume = 1;
        }else if(volume < 0){
            volume = 0;
        }
        conf["volume"] = volume;
        if(dispatcher){
            dispatcher.setVolume(volume);
        }
    }catch(e){
        message.channel.send("Bot isnt in a voice channel!");
    }
}

module.exports.help = {
    name: "volume",
    desc: "Sets the bots volume.",
    usage: "/volume {volume %0-100}"
}
© 2018 GitHub, Inc.
