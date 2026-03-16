export const SIMPLE_CSV = "Clave,Origen\r\n1,Hello\r\n2,World";
export const SIMPLE_ROWS = [
  ["Clave", "Origen"],
  ["1", "Hello"],
  ["2", "World"],
];

export const CSV_WITH_COMMAS = 'a,b,c\r\n"1,2",three,"four,five"';
export const ROWS_WITH_COMMAS = [
  ["a", "b", "c"],
  ["1,2", "three", "four,five"],
];

export const CSV_WITH_QUOTES = 'k,v\r\n"say \\"hi\\"",ok';
export const CSV_EMPTY = "";
export const CSV_HEADER_ONLY = "A,B,C";
export const ROWS_HEADER_ONLY = [["A", "B", "C"]];

export const CSV_CRLF = "x,y\r\n1,2";
export const ROWS_CRLF = [
  ["x", "y"],
  ["1", "2"],
];
