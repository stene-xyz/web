module.exports = {
    getDateString: function() {
        var date = new Date(Date.now());
        return date.toISOString();
    },
    verbose: function(type, message, data = false) {
        var messageData = {};
        messageData.timestamp = this.getDateString();
        messageData.importance = 0;
        messageData.eventType = type;
        messageData.message = message;
        if(data) messageData.data = data;
        console.log(JSON.stringify(messageData));
    },
    info: function(type, message, data = false) {
        var messageData = {};
        messageData.timestamp = this.getDateString();
        messageData.importance = 1;
        messageData.eventType = type;
        messageData.message = message;
        if(data) messageData.data = data;
        console.log(JSON.stringify(messageData));
    },
    warn: function(type, message, data = false) {
        var messageData = {};
        messageData.timestamp = this.getDateString();
        messageData.importance = 2;
        messageData.eventType = type;
        messageData.message = message;
        if(data) messageData.data = data;
        console.error(JSON.stringify(messageData));
    },
    error: function(type, message, data = false) {
        var messageData = {};
        messageData.timestamp = this.getDateString();
        messageData.importance = 3;
        messageData.eventType = type;
        messageData.message = message;
        if(data) messageData.data = data;
        console.error(JSON.stringify(messageData));
    }
};