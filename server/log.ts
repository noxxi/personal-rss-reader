let _debug = 5;

export function level(l: number) {
  _debug = l;
}
export default function debug(...msg: any[]) {
  xdebug(0,...msg)
}

export function xdebug(level: number, ...msg: any[]) {
  if (_debug>=level) { console.log(Date.now() + `  DEBUG[${level}] `,...msg) }
}

export function verbose(...msg: any[]) {
  console.log(Date.now() + '  [*] ',...msg);
}
