
module.exports = {
'setvolembed' : 'setvolembed',
};
var setvolembed = new Discord.RichEmbed()
.setTitle("volume controls")
.setDescription(`volume set ${args[1]}%`)
.setThumbnail("https://images-ext-1.discordapp.net/external/v1EV83IWPZ5tg7b5NJwfZO_drseYr7lSlVjCJ_-PncM/https/cdn.discordapp.com/icons/268683615632621568/168a880bdbc1cb0b0858f969b2247aa3.jpg?width=80&height=80")
.setFooter("Changed by: " + message.author.username.toString(), message.author.avatarURL);
          
          
