var QRMode = require('./QRMode');

// Izmena za Atmos Radionicu: tekst se upisuje kao UTF-8 bajtovi (obavezno za NBS IPS QR, npr. „č“, „Đ“)
function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.bytes = Array.from(new TextEncoder().encode(data));
}

QR8bitByte.prototype = {
	getLength : function() {
		return this.bytes.length;
	},
	write : function(buffer) {
		for (var i = 0; i < this.bytes.length; i++) buffer.put(this.bytes[i], 8);
	}
};

module.exports = QR8bitByte;
