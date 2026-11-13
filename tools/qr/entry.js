// QR kod kao SVG (za NBS IPS QR na računu i predračunu)
var QRCode = require('./QRCode');
var ECL = require('./QRErrorCorrectLevel');
window.AtmosQR = {
  matrix: function (text) {
    var q = new QRCode(-1, ECL.M); q.addData(text); q.make();
    var n = q.getModuleCount(), m = [];
    for (var r = 0; r < n; r++) { m.push([]); for (var c = 0; c < n; c++) m[r].push(q.isDark(r, c)); }
    return m;
  },
  svg: function (text, size) {
    var m = this.matrix(text), n = m.length, qz = 4, t = n + qz * 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (m[r][c]) d += 'M' + (c + qz) + ' ' + (r + qz) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + ' ' + t + '" width="' + (size || 132) + '" height="' + (size || 132) +
      '" shape-rendering="crispEdges"><rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
};
