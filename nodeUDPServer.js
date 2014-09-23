var PORT = 5000;
var HOST = '127.0.0.1';

var Map = require("collection").Map;
var Vector = require("collection").Vector;

var dgram = require('dgram');
var UDPServer = dgram.createSocket('udp4');

// Constants
var DurationToTimeOutMilliseconds               = 5000;
var DurationToSendUpdates                       = 4;

// Packet Variables and Constants
var TYPE_Acknowledge                            = 10;
var TYPE_Victory                                = 11;
var TYPE_Update                                 = 12;
var TYPE_Reset                                  = 13;

var currentPacketNumber                         = 0;
var PACKET_SIZE_FOR_BUFFER                      = 40;

// Core Data Structures and Variables
var clientMap                                   = new Map;
var currentNumClients                           = 0;

// My own stuff
var UDPClient = function( address, port, IPAndPortAsString, timeStampOfPacket )
{
    ++currentNumClients;
    // public vars

    // Network Data
    this.m_clientKey                            = IPAndPortAsString;
    this.m_timeStampOfPacketLastReceived        = timeStampOfPacket;
    this.m_ipAddress                            = address;
    this.m_port                                 = port;

    // Player Data
    this.m_playerID                             = currentNumClients;
    this.m_xPos                                 = 0.0;
    this.m_yPos                                 = 0.0;
    this.m_xVel                                 = 0.0;
    this.m_yVel                                 = 0.0;
    this.m_yawDegrees                           = 0.0;

    console.log( 'Assigning Colors For Player Number: ' + currentNumClients );

    // Assign a color
    if ( currentNumClients == 0 )
    {
        this.m_red = 50.0;
        this.m_green = 250.0;
        this.m_blue = 250.0;
    }
    else if ( currentNumClients == 1 )
    {
        this.m_red = 250.0;
        this.m_green = 50.0;
        this.m_blue = 250.0;
    }
    else if ( currentNumClients == 2 )
    { 
        this.m_red = 50.0;
        this.m_green = 250.0;
        this.m_blue = 50.0;
    }
    else if ( currentNumClients == 3 )
    {
        this.m_red = 250.0;
        this.m_green = 50.0;
        this.m_blue = 50.0;
    }
    else if ( currentNumClients == 4 )
    {
        this.m_red = 250.0;
        this.m_green = 250.0;
        this.m_blue = 50.0;
    }
    else
    {
        console.log( 'Warning: no more than four players is supported! Player defaults to white color' );
        this.m_red                                  = 255.0;
        this.m_green                                = 255.0;
        this.m_blue                                 = 255.0;
    }
}


var L4Packet = function( message )
{
    var currentOffset = 0;

    if ( message === undefined )
    {
        ++currentPacketNumber;

        this.packetID = -1;
        this.red = 250;
        this.green = 250;
        this.blue = 250;
        this.packetNumber = currentPacketNumber;
        this.timeStamp = Date.now();

    }
    else
    {
         // *** Packet Header *** //

        // Packet ID / Type
        this.packetID = message.readUInt8( currentOffset );
        currentOffset += 1;

        // Color
        this.red = message.readUInt8( currentOffset );
        currentOffset += 1;
        this.green = message.readUInt8( currentOffset );
        currentOffset += 1;
        this.blue = message.readUInt8( currentOffset );
        currentOffset += 1;

        // Packet Number
        this.packetNumber = message.readUInt32LE( currentOffset );
        currentOffset += 4;

        // Time Stamp
        this.timeStamp = message.readDoubleLE( currentOffset );
        currentOffset += 8;

        //console.log( this.packetID );
        //console.log( this.packetNumber );
        //console.log( this.timeStamp );

        // *** End Packet Header *** //

        // *** Union Contents *** //

        if ( this.packetID === TYPE_Acknowledge )
        {
            this.packetType = message.readUInt8( currentOffset );
            currentOffset += 4; // +4 b.c alignment ( easy gotcha )
            this.packetNumAcked = message.readUInt32LE( currentOffset );
            currentOffset += 4;

            //console.log( this.packetType );
            //console.log( this.packetNumAcked );
        }
        else if ( this.packetID === TYPE_Reset )
        {
            console.log( 'Warning: Reset packet received from client! This is NOT allowed\n' );
        }
        else if ( this.packetID === TYPE_Update )
        {
            //console.log( 'Packet Of Type UPDATE is being parsed' );
            this.xPosition = message.readFloatLE( currentOffset );
            currentOffset += 4;
            this.yPosition = message.readFloatLE( currentOffset );
            currentOffset += 4;
            this.xVelocity = message.readFloatLE( currentOffset );
            currentOffset += 4;
            this.yVelocity = message.readFloatLE( currentOffset );
            currentOffset += 4;
            this.yawDegrees = message.readFloatLE( currentOffset );
            currentOffset += 4;

            //console.log( this.xPosition + ' ' + this.yPosition );

        }
        else if ( this.packetID === TYPE_Victory )
        {
            this.m_red = message.readUInt8( currentOffset );
            currentOffset += 4;
            this.m_green = message.readUInt8( currentOffset );
            currentOffset += 4;
            this.m_blue = message.readUInt8( currentOffset );
            currentOffset += 4;

        }

        //console.log( '\n' );
    }    
}

// -------------- NODE SERVER CALLBACKS ----------------- // 
UDPServer.on( 'listening', function () 
{
    var address = UDPServer.address();
    console.log('UDP Server created and listening on ' + address.address + " : " + address.port + '\n' );
});


UDPServer.on( 'message', function ( message, remote ) 
{
    // PR: Debug stuff... uncomment if you wish
	//console.log( 'Packet received from client with address and port:' );
    //console.log( remote.address + ' : ' + remote.port );

   processClientPacket( message, remote );
   
});

UDPServer.bind(PORT, HOST);

// -------------- END NODE SERVER CALLBACKS ----------------- // 

function sendPacket( UDPClientRecipient, packetToSend )
{
    var messageToSend = convertPacketToBuffer( packetToSend );

    //console.log( messageToSend.toString("utf-8") );
    //console.log( 'Sending packet to client with message length: ' + messageToSend.length );
    //console.log( UDPClientRecipient.m_ipAddress );
    //console.log( UDPClientRecipient.m_port );

    UDPServer.send( messageToSend, 0, messageToSend.length, UDPClientRecipient.m_port, UDPClientRecipient.m_ipAddress, function( err, bytes ) 
    {
        //console.log( 'Error sending packet to UDPClient!' );
        //console.log( err );
    }); 
}


function convertPacketToBuffer( packetToConvert )
{
    var currentOffset = 0;
    var bufferFromPacket = new Buffer( PACKET_SIZE_FOR_BUFFER );

    // -------------- HEADER ELEMENTS ----------------- //

    // Packet Type / ID
    bufferFromPacket.writeUInt8( packetToConvert.packetID, currentOffset );
    currentOffset += 1;

    // COLOR
    bufferFromPacket.writeUInt8( packetToConvert.red, currentOffset );
    currentOffset += 1;
    bufferFromPacket.writeUInt8( packetToConvert.green, currentOffset );
    currentOffset += 1;
    bufferFromPacket.writeUInt8( packetToConvert.blue, currentOffset );
    currentOffset += 1;

    // Packet Number and TimeStamp
    bufferFromPacket.writeUInt32LE( packetToConvert.packetNumber, currentOffset );
    currentOffset += 4;
    bufferFromPacket.writeDoubleLE( packetToConvert.timeStamp, currentOffset );
    currentOffset += 8;

    // ------------------- UNION CONTENTS ------------------- //
    if ( packetToConvert.packetID === TYPE_Update )
    {
        //console.log( 'Sending packet of type UPDATE \n' );
        bufferFromPacket.writeFloatLE( packetToConvert.xPosition, currentOffset );
        currentOffset += 4;
        bufferFromPacket.writeFloatLE( packetToConvert.yPosition, currentOffset );
        currentOffset += 4;
        bufferFromPacket.writeFloatLE( packetToConvert.xVelocity, currentOffset );
        currentOffset += 4;
        bufferFromPacket.writeFloatLE( packetToConvert.yVelocity, currentOffset );
        currentOffset += 4;
        bufferFromPacket.writeFloatLE( packetToConvert.yawDegrees, currentOffset );
        currentOffset += 4;

    }
    else if ( packetToConvert.packetID === TYPE_Reset )
    {
        //console.log( 'Sending packet of type RESET \n' );
        bufferFromPacket.writeFloatLE( packetToConvert.flagXPosition, currentOffset );
        currentOffset += 4;
        bufferFromPacket.writeFloatLE( packetToConvert.flagYPosition, currentOffset );
        currentOffset += 4;
        bufferFromPacket.writeFloatLE( packetToConvert.playerXPosition, currentOffset );
        currentOffset += 4;
        bufferFromPacket.writeFloatLE( packetToConvert.playerYPosition, currentOffset );
        currentOffset += 4;
        bufferFromPacket.writeUInt8( packetToConvert.m_red, currentOffset );
        currentOffset += 1;
        bufferFromPacket.writeUInt8( packetToConvert.m_green, currentOffset );
        currentOffset += 1;
        bufferFromPacket.writeUInt8( packetToConvert.m_blue, currentOffset );
        currentOffset += 1;
    }
    else if ( packetToConvert.packetID === TYPE_Victory )
    {
        console.log( 'Sending packet of type VICTORY \n' );
        bufferFromPacket.writeUInt8( packetToConvert.m_red, currentOffset );
        currentOffset += 1;
        bufferFromPacket.writeUInt8( packetToConvert.m_green, currentOffset );
        currentOffset += 1;
        bufferFromPacket.writeUInt8( packetToConvert.m_blue, currentOffset );
        currentOffset += 1;
    }
    else if ( packetToConvert.packetID === TYPE_Acknowledge )
    {
        console.log( 'Warning: TYPE_Acknowledge is not currently build for server. Cannot send this type of packet\n' );
    }

    return bufferFromPacket;
}

// PR: so hacky but I cant figure out how to do out variables in javascript
var  newClientWasCreated = false; 

function processClientPacket( message, remote )
{
    var clientWhoSentPacket = addOrUpdateExistingClient( message, remote );

    var packetReceived = new L4Packet( message );

    if ( newClientWasCreated )
    {
        sendResetPacketToNewClient( packetReceived, clientWhoSentPacket );
    }

    newClientWasCreated = false;
}


function sendResetPacketToNewClient( clientPacketReceived, clientWhoSentPacket )
{
    resetPacketToSend = new L4Packet();

    // Header data
    resetPacketToSend.packetID = TYPE_Reset;
    resetPacketToSend.red = clientWhoSentPacket.m_red;
    resetPacketToSend.green = clientWhoSentPacket.m_green;
    resetPacketToSend.blue = clientWhoSentPacket.m_blue;
    resetPacketToSend.timeStamp = Date.now();

    resetPacketToSend.flagXPosition = 50.0;
    resetPacketToSend.flagYPosition = 50.0;
    resetPacketToSend.playerXPosition = 10.0;
    resetPacketToSend.playerYPosition = 10.0;

    resetPacketToSend.m_red = clientWhoSentPacket.m_red;
    resetPacketToSend.m_green = clientWhoSentPacket.m_green;
    resetPacketToSend.m_blue = clientWhoSentPacket.m_blue;

    sendPacket( clientWhoSentPacket, resetPacketToSend );
}

// PR: Returns boolean whether a new client has been created or not
function addOrUpdateExistingClient( message, remote )
{
    var clientKey = ( remote.address + ' ' + remote.port );

    var clientDoesExist = clientMap.has( clientKey );
    var currentTime = Date.now();

    if ( clientDoesExist )
    {
        var existingUDPClient = clientMap.get( clientKey );

        // Parse the packet
        var packetFromClient = new L4Packet( message );

       // console.log( 'PACKET ID RECEIVED FROM CLIENT: ' + packetFromClient.packetID );

        if ( packetFromClient.packetID === TYPE_Update )
        {
            existingUDPClient.m_xPos = packetFromClient.xPosition;
            existingUDPClient.m_yPos = packetFromClient.yPosition;
            existingUDPClient.m_xVel = packetFromClient.xVelocity;
            existingUDPClient.m_yVel = packetFromClient.yVelocity;
            existingUDPClient.m_yawDegrees = packetFromClient.yawDegrees;

            //console.log( 'Updating existing client with xPos: ' + existingUDPClient.m_xPos + ' yPos: ' + existingUDPClient.m_yPos );
        }

        // Update Timestamp
        existingUDPClient.m_timeStampOfPacketLastReceived = currentTime;

        clientMap.set( clientKey, existingUDPClient );
        return existingUDPClient;
    }
    else
    {
        // NEW Client
        var newUDPClient = new UDPClient( remote.address, remote.port, clientKey, currentTime );
        clientMap.set( clientKey, newUDPClient );
        console.log( ' A new client has connected with IP and port: ' + clientKey );
        newClientWasCreated = true;
        return newUDPClient;
    }
}


var checkStatusOfUDPClients = function()
{
   
    timeOutExpiredClients();
    displayListOfConnectedUsers();
	
    setTimeout( checkStatusOfUDPClients, DurationToTimeOutMilliseconds );
}


function timeOutExpiredClients()
{
    var clientsToRemove = new Vector();
    
    clientMap.each( function( client ) 
    {
        var existingUDPClient = client.value();
        var lastPacketReceived = existingUDPClient.m_timeStampOfPacketLastReceived;
        var currentTime = Date.now();
        var timeDif = currentTime - lastPacketReceived;

        if ( timeDif > DurationToTimeOutMilliseconds )
        {
            var clientKey = client.key();
            clientsToRemove.add( clientKey );
        }

    });


    clientsToRemove.each( function( client, vecIterator ) {

        --currentNumClients;
        clientMap.remove( client );
        console.log( client + ' is timing out and being removed from server registry' );

    });
}


function displayListOfConnectedUsers()
{
    console.log( '------------------- List Of Connected Users -----------------------\n\n' );

    if ( clientMap.isEmpty() )
    {
        console.log( 'There are currently no users connected to the server\n\n' );
    }
    else
    {
        clientMap.each( function( client ) 
        {
            console.log( client.key() + ' is currently connected to the server\n' );
        });
    }

    console.log( '\n' );
}


function sendGameUpdatesToClients()
{
    var packetsToSend = new Vector();

    clientMap.each( function( client ) 
    {
       var existingUDPClient = client.value();

       var updatePacket = new L4Packet();

       // Header
       updatePacket.packetID = TYPE_Update;
       updatePacket.red = existingUDPClient.m_red;
       updatePacket.green = existingUDPClient.m_green;
       updatePacket.blue = existingUDPClient.m_blue;
       updatePacket.timeStamp = Date.now();

       // Update Stuff
       updatePacket.xPosition = existingUDPClient.m_xPos;
       updatePacket.yPosition = existingUDPClient.m_yPos;
       updatePacket.xVelocity = existingUDPClient.m_xVel;
       updatePacket.yVelocity = existingUDPClient.m_yVel;
       updatePacket.yawDegrees = existingUDPClient.m_yawDegrees;

       packetsToSend.add( updatePacket );

    });


    clientMap.each( function( client ) 
    {
        
        packetsToSend.each( function( packetToSend, vecIterator ) {   

            var existingUDPClient = client.value();
            sendPacket( existingUDPClient, packetToSend );

        });
           
    });


    setTimeout( sendGameUpdatesToClients, DurationToSendUpdates );
}


checkStatusOfUDPClients();
sendGameUpdatesToClients();