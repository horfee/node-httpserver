'use strict';

var http = require("http");
var fs   = require("fs");
var {URL}  = require("url");

function FileHandler(config){
	this.rootPath = config.documentRoot;
	this.mimeTypes = config.mimeTypes;

	if ( this.rootPath == undefined || this.rootPath == "" ) this.rootPath = ".";
	if ( this.rootPath.endsWith("/") ) this.rootPath = this.rootPath.substring(0, this.rootPath.length - 1);
	if ( this.mimeTypes == undefined || typeof(this.mimeTypes) !== "object" ) this.mimeTypes = {};

	this.mimeTypes = Object.keys(this.mimeTypes).reduce( function(key) {
		key = "" + key;
		var r = {};
		r[key.toLowerCase()] = this.mimeTypes[key];
		return r;
	}.bind(this));
}

FileHandler.prototype.resolveFile = function(request) {
	var u = new URL("http://host:1" + request.url);
	return this.rootPath + (u.pathname ? u.pathname : "/");
}

FileHandler.prototype.resolveMimeType = function(file) {
	var idx = file.lastIndexOf(".");
	if ( idx == -1 ) return null;
	var extension = file.substring(idx).toLowerCase();
	return this.mimeTypes[extension];
}

FileHandler.prototype.doGet = function(request, response){

	try {
		var f = this.resolveFile(request);
		console.log("opening file : " + f);
		var buffer = fs.readFileSync(f, { flag: "r"});

		var ct = this.resolveMimeType(f);
		if ( ct ) {
			response.writeHead(200, {"Content-Type": ct});
		} else {
			response.writeHead(200, {});
		}
		response.write(buffer);
	} catch(error) {
		if ( error.code == "ENOENT" ) {
			response.writeHead(404);
		} else {
			response.writeHead(500, {"Content-Type": "text/plain"});	
		}
		response.write(error.toString());
	}
};
FileHandler.prototype.doPost = function(request, response){};
FileHandler.prototype.doDelete = function(request, response){};
FileHandler.prototype.doHead = function(request, response){};
FileHandler.prototype.doOptions = function(request, response){};

function HTTPServer(config, handlers) {
	this.configuration = Object.assign({}, config);
	this.handlers = handlers;

	if ( typeof(this.configuration.port) !== "number" ) this.configuration.port = parseInt(this.configuration.port);
	if ( this.configuration.port < 0 || this.configuration.port > 65535 ) this.configuration.port = 0;
	if ( this.configuration.listen == null ) this.configuration.listen = "0.0.0.0";

	if ( this.handlers == undefined ) this.handlers = {};
	if ( this.handlers.default == undefined ) this.handlers.default = new FileHandler(this.configuration);

	
	// adding default index.html redirection
	Object.assign(this.handlers, {"^/$":{
		doGet:function(request, response) {
			var protocol = "http";
			var redirection = protocol + "://" + this.configuration.hostName + ":" + this.configuration.port + "/" + this.configuration.indexFile;
			response.writeHead(301, {"Location": redirection});
		}.bind(this)
	}});
}

HTTPServer.prototype.start = function() {
	if ( this.server == null ) {
		this.server = http.createServer(function(request, response) {

			var method = request.method.toLowerCase();
			method = "do" + method[0].toUpperCase() + method.substring(1);

			var url = request.url;
			var handler = Object.keys(this.handlers).filter( (pattern) => pattern != "default" && new RegExp(pattern).test(url))[0];
			if ( handler == undefined ) {
				handler = "default";
			}
			if ( this.handlers[handler][method] ) {
				this.handlers[handler][method](request,response);
			}
			// response.writeHead(200, {"Content-Type": "text/plain"});
			// response.write("Hello World");
			response.end();
		}.bind(this));
	}
	this.server.listen(this.configuration.port, this.configuration.listen, () => console.info("Server bound"));
}

HTTPServer.prototype.stop = function() {

}

module.exports = HTTPServer;