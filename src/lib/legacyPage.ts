// Halaman form member (/) dan validasi leader (/?page=leader). Dulu disalin dari Code-satu-file.txt
// (Apps Script v1.8); sekarang file inilah sumbernya, Apps Script tidak dipakai lagi.
// Teks mentah (String.raw): jangan pakai backtick atau ${ di dalamnya.
export const PAGE_HTML: string = String.raw`<!DOCTYPE html>
<html lang="id">
<head>
<base target="_top">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Laporan Produksi QA</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<style>
:root{
  --red:#9B1B1F; --red-d:#7F1519; --red-soft:#F8E8E8; --green:#166534; --green-soft:#DCFCE7;
  --ink:#16181D; --ink2:#4A4F5A; --muted:#8A909C; --line:#E7E8EC; --line2:#F0F1F4;
  --bg:#F5F6F8; --card:#FFFFFF; --ok:#12805C; --ok-soft:#E7F6EF; --warn:#B4600B; --warn-soft:#FFF4E5;
  --r:16px; --shadow:0 1px 2px rgba(16,24,40,.04),0 4px 16px rgba(16,24,40,.06);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:'Plus Jakarta Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.45}
button,input,textarea{font:inherit;color:inherit}
.wrap{max-width:760px;margin:0 auto;padding:0 16px 150px}
/* Header */
.hero{background:var(--red);color:#fff}
.hero-in{max-width:760px;margin:0 auto;padding:18px 16px 16px;display:flex;align-items:center;gap:14px}
.hero img{height:26px;width:auto;display:block}
.hero .logo{background:#fff;border-radius:9px;padding:5px 7px;flex:none}
.hero .t{min-width:0}
.hero h1{margin:0;font-size:18px;font-weight:800;letter-spacing:-.01em}
.hero p{margin:2px 0 0;color:rgba(255,255,255,.85);font-size:13px}
.accent{display:none}
/* Sections */
.sec-h{display:flex;align-items:center;justify-content:space-between;margin:26px 2px 10px}
.sec-h h2{margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}
.sec-h .cnt{font-size:12px;color:var(--muted);font-weight:600}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);padding:16px}
.grid{display:grid;gap:12px}
.g2{grid-template-columns:1fr 1fr}
.g4{grid-template-columns:repeat(4,1fr)}
@media(max-width:560px){.g4{grid-template-columns:1fr 1fr}}
label.f{display:block}
.lb{display:block;font-size:12px;font-weight:600;color:var(--ink2);margin:0 0 6px}
.lb .req{color:var(--red)}
.in,.pick{width:100%;height:48px;border:1.5px solid var(--line);border-radius:12px;background:#fff;padding:0 14px;outline:none;transition:border-color .15s,box-shadow .15s;font-size:15px}
.in:focus,.pick:focus{border-color:var(--ink);box-shadow:0 0 0 4px rgba(22,24,29,.06)}
textarea.in{height:auto;min-height:48px;padding:12px 14px;resize:vertical}
.in.num{font-variant-numeric:tabular-nums;font-weight:600}
.pick{display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;cursor:pointer}
.pick span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pick .ph{color:var(--muted);font-weight:400}
.pick svg{flex:none;color:var(--muted)}
.pick:disabled{background:var(--line2);cursor:not-allowed}
.err .in,.err .pick{border-color:var(--red);background:#FFFAFA}
.hint{font-size:12px;color:var(--muted);margin-top:6px}
.notice{display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:10px 12px;border-radius:12px;font-size:13px;background:var(--warn-soft);color:var(--warn)}
.notice.ok{background:var(--ok-soft);color:var(--ok)}
/* Segmented */
.seg{display:flex;gap:6px;flex-wrap:wrap}
.seg button{height:40px;min-width:56px;padding:0 14px;border-radius:10px;border:1.5px solid var(--line);background:#fff;font-weight:700;cursor:pointer}
.seg button.on{background:var(--ink);border-color:var(--ink);color:#fff}
/* Item cards */
.item{padding:0;overflow:hidden;margin-bottom:12px}
.item-h{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;user-select:none}
.badge{flex:none;width:30px;height:30px;border-radius:9px;background:var(--red);color:#fff;font-weight:800;font-size:13px;display:grid;place-items:center}
.item-h .ttl{flex:1;min-width:0}
.item-h .ttl b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.item-h .ttl small{display:block;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.icon-btn{flex:none;width:36px;height:36px;border-radius:10px;border:none;background:transparent;color:var(--ink2);display:grid;place-items:center;cursor:pointer}
.icon-btn:hover{background:var(--line2)}
.chev{transition:transform .2s}
.item.closed .chev{transform:rotate(-90deg)}
.item-b{padding:4px 16px 16px;border-top:1px solid var(--line2)}
.item.closed .item-b{display:none}
.item.invalid{border-color:var(--red)}
.sub{margin:18px 0 10px;font-size:12px;font-weight:700;color:var(--ink2);display:flex;align-items:center;gap:8px}
.sub::after{content:"";flex:1;height:1px;background:var(--line2)}
.pair{border:1px solid var(--line2);border-radius:12px;padding:12px;background:#FAFAFB}
.pair .ph{font-size:12px;font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between}
.pair .ph em{font-style:normal;color:var(--muted);font-weight:600}
.ng-t{width:100%;display:flex;align-items:center;justify-content:space-between;background:#FAFAFB;border:1px dashed var(--line);border-radius:12px;padding:12px 14px;cursor:pointer;font-weight:600;margin-top:14px}
.ng-t .tot{font-size:12px;padding:3px 9px;border-radius:99px;background:var(--line2);color:var(--ink2)}
.ng-t .tot.has{background:var(--red-soft);color:var(--red-d)}
.ng-g{display:none;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px}
.ng-g.open{display:grid}
@media(min-width:561px){.ng-g{grid-template-columns:repeat(5,1fr)}}
.ng-g .lb{font-size:11px;min-height:28px;line-height:1.25}
.add{width:100%;height:56px;border-radius:var(--r);border:1.5px dashed #C9CCD3;background:transparent;font-weight:700;color:var(--ink2);display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}
.add:hover{border-color:var(--ink);color:var(--ink);background:#fff}
.lt-row{display:grid;grid-template-columns:1fr 110px 36px;gap:10px;align-items:end;padding:12px 0;border-bottom:1px solid var(--line2)}
.lt-row:first-child{padding-top:0}
.lt-row .rm{grid-column:1/3}
@media(max-width:560px){.lt-row{grid-template-columns:1fr 92px 36px}}
.empty{color:var(--muted);font-size:13px;text-align:center;padding:4px 0 12px}
/* Bottom bar */
.bar{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid var(--line);z-index:20}
.bar-in{max-width:760px;margin:0 auto;padding:12px 16px calc(12px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:14px}
.stats{flex:1;display:flex;gap:18px;min-width:0;overflow-x:auto}
.stat small{display:block;font-size:11px;color:var(--muted);font-weight:600;white-space:nowrap}
.stat b{font-size:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
.stat b.over{color:var(--warn)}
.btn{height:50px;padding:0 22px;border-radius:14px;border:none;background:var(--red);color:#fff;font-weight:800;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:0 6px 16px rgba(155,27,31,.22);white-space:nowrap}
.btn:hover{background:var(--red-d)}
.btn:disabled{opacity:.5;box-shadow:none;cursor:default}
.btn.ghost{background:#fff;color:var(--ink);border:1.5px solid var(--line);box-shadow:none}
@media(max-width:420px){.stats{gap:12px}.stat b{font-size:14px}.btn{padding:0 16px}}
/* Sheets / modal */
.ov{position:fixed;inset:0;background:rgba(16,18,24,.45);z-index:40;display:none;align-items:flex-end;justify-content:center}
.ov.open{display:flex}
.sheet{background:#fff;width:100%;max-width:560px;max-height:86vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;animation:up .22s ease}
@media(min-width:640px){.ov{align-items:center}.sheet{border-radius:20px;max-height:80vh}}
@keyframes up{from{transform:translateY(30px);opacity:.4}to{transform:none;opacity:1}}
.sheet-h{padding:18px 18px 10px}
.sheet-h h3{margin:0 0 12px;font-size:17px}
.search{position:relative}
.search input{padding-left:42px}
.search svg{position:absolute;left:14px;top:14px;color:var(--muted)}
.opts{overflow:auto;padding:4px 10px 16px}
.opt{width:100%;text-align:left;padding:13px 12px;border:none;background:none;border-radius:10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:15px}
.opt:hover,.opt.hl{background:var(--line2)}
.opt.sel{font-weight:700;color:var(--red-d)}
.opt small{color:var(--muted);font-size:12px;font-weight:500;text-align:right}
.opt>span{white-space:nowrap}
.opt-h{padding:12px 12px 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.opt small.alt{color:var(--warn)}
.sheet-f{padding:14px 18px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end}
.rv{padding:0 18px 8px;overflow:auto}
.rv table{width:100%;border-collapse:collapse;font-size:13px}
.rv th{text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 6px;border-bottom:1px solid var(--line)}
.rv td{padding:9px 6px;border-bottom:1px solid var(--line2);vertical-align:top}
.rv td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.rv .meta{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;margin:0 0 12px;color:var(--ink2)}
.rv .warns{margin:10px 0 4px}
/* Done */
.done{display:none;text-align:center;padding:60px 16px}
.done .ck{width:76px;height:76px;border-radius:50%;background:var(--ok-soft);color:var(--ok);display:grid;place-items:center;margin:0 auto 18px;animation:pop .35s ease}
@keyframes pop{from{transform:scale(.6)}to{transform:none}}
.done h2{margin:0 0 6px;font-size:22px}
.done p{color:var(--ink2);margin:0 0 24px}
.done .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.loading{padding:80px 16px;text-align:center;color:var(--muted)}
.spin{width:28px;height:28px;border:3px solid var(--line);border-top-color:var(--red);border-radius:50%;animation:sp 0.8s linear infinite;margin:0 auto 12px}
.btn .spin{width:18px;height:18px;margin:0;border-color:rgba(255,255,255,.35);border-top-color:#fff}
@keyframes sp{to{transform:rotate(360deg)}}
.hero-in .mode{margin-left:auto;font-size:13px;font-weight:700;color:#fff;text-decoration:none;border:1.5px solid rgba(255,255,255,.5);border-radius:10px;padding:8px 12px;white-space:nowrap}
.hero-in .mode:hover{background:rgba(255,255,255,.12)}
.subs{margin-top:12px;display:grid;gap:8px}
.subrow{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:12px;background:#FAFAFB;border:1px solid var(--line2);font-size:13px}
.subrow .grow{flex:1;min-width:0}
.pill{flex:none;font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;background:var(--line2);color:var(--ink2);white-space:nowrap}
.pill.w{background:var(--warn-soft);color:var(--warn)}.pill.ok{background:var(--ok-soft);color:var(--ok)}.pill.no{background:var(--red-soft);color:var(--red-d)}
.tabs{display:flex;gap:6px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:5px;margin-top:20px}
.tabs button{flex:1;height:42px;border:none;background:none;border-radius:10px;font-weight:700;color:var(--ink2);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.tabs button.on{background:var(--ink);color:#fff}
.tabs .c{font-size:11px;padding:2px 7px;border-radius:99px;background:var(--line2);color:var(--ink2)}
.tabs button.on .c{background:rgba(255,255,255,.2);color:#fff}
.lbar{display:flex;gap:10px;align-items:center;margin:14px 0 10px;flex-wrap:wrap}
.lbar .in{width:auto;height:42px;flex:1;min-width:150px}
.sc{margin-bottom:12px;padding:0;overflow:hidden}
.sc-h{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;cursor:pointer}
.sc-h input[type=checkbox]{width:20px;height:20px;margin:6px 0 0;accent-color:var(--red);flex:none}
.sc-h .ttl{flex:1;min-width:0}
.sc-h .ttl b{display:block;font-size:15px}
.sc-h .ttl small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.chip{font-size:12px;font-weight:600;padding:4px 9px;border-radius:8px;background:var(--line2);color:var(--ink2)}
.sc-b{display:none;border-top:1px solid var(--line2);padding:12px 16px 16px}
.sc.open .sc-b{display:block}
.sc-b .rv{padding:0}
.sc-f{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
.sc-f .btn{height:44px;padding:0 18px;font-size:14px}
.btn.dark{background:var(--ink);box-shadow:none}
.ed-it{border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:12px}
.ed-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.ed-h .grow{flex:1;min-width:0}.ed-h small{display:block;color:var(--muted);font-size:12px}
.ed-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.ed-sec{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:14px 0 8px}
.ed-f .btn{padding:0 14px;font-size:14px;height:46px}
#hist:empty{display:none}
.hist-t{width:100%;display:flex;align-items:center;gap:8px;border:none;background:none;padding:6px 0;font-weight:700;font-size:14px;color:var(--ink);cursor:pointer;text-align:left}
.hist-t span:first-child{flex:1}.hist-t .cnt{font-size:12px;color:var(--muted);font-weight:600}
.ob-i{display:block;font-size:12px;color:var(--ok);margin-top:4px;min-height:0}
.ver{display:block;font-size:11px;font-weight:600;color:rgba(255,255,255,.7);margin-top:2px;letter-spacing:.02em}
.sm-btn{height:36px;padding:0 12px;font-size:13px;margin-top:8px;box-shadow:none}
.login{max-width:420px;margin:40px auto 0}
.login h2{margin:0 0 4px;font-size:20px}
.login p{margin:0 0 18px;color:var(--muted);font-size:13px}
@media(max-width:480px){.hero p{display:none}.hero h1{font-size:16px}.hero img{height:22px}.hero-in{gap:10px;padding:12px 16px}.hero-in .mode{padding:7px 10px;font-size:12px}}
.toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 16px;border-radius:12px;font-size:13px;z-index:60;opacity:0;transition:opacity .2s;pointer-events:none;max-width:90vw}
.toast.show{opacity:1}

/* ---- Tampilan v2.3 (marun TAKAI): isi dan alur sama ---- */
.band{background:var(--red);color:#fff;margin:0 -16px;padding:2px 16px 18px;box-shadow:0 0 0 100vmax var(--red);clip-path:inset(0 -100vmax)}
.idrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:10px}
.idc{display:block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:14px;padding:8px 12px;min-width:0;cursor:pointer;text-align:left;color:#fff}
.idc small{display:block;font-size:11px;font-weight:600;opacity:.8}
.idc input,.idc b{display:block;width:100%;background:none;border:0;color:#fff;font-weight:700;font-size:15px;padding:0;height:24px;outline:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.idc input::-webkit-calendar-picker-indicator{filter:invert(1);opacity:.8}
.idc.err{border-color:#FFD7D9;background:rgba(255,255,255,.26)}
.idc .ph{opacity:.75;font-weight:600}
.band .notice{background:#fff}.band .subs .subrow{background:#fff;color:var(--ink)}
.band .hist-t{color:#fff}.band .hist-t .cnt{color:rgba(255,255,255,.8)}.band #hist{margin-top:10px}
.band .empty{color:rgba(255,255,255,.85)}
.meter{margin-top:14px;background:#fff;color:var(--ink);border-radius:var(--r);padding:12px 14px;box-shadow:var(--shadow)}
.mt-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:14px}
.mt-top b.v{font-size:18px}
.mt-top .st{font-weight:600;white-space:nowrap}
.mt-bar{height:10px;border-radius:99px;background:var(--line2);display:flex;overflow:hidden;margin:8px 0 6px}
.mt-bar i{display:block;height:100%}
.mt-bar .p{background:var(--red)}.mt-bar .l{background:#E7A9AB}
.mt-leg{display:flex;gap:14px;font-size:12px;color:var(--muted);flex-wrap:wrap}
.mt-leg span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;background:var(--red)}
.mt-leg span.l::before{background:#E7A9AB}
.okc{color:var(--green)}.wc{color:var(--warn)}
.cchips{display:flex;gap:6px;flex-wrap:wrap}
.cchips button,.qchips button{min-height:40px;padding:0 14px;border-radius:99px;border:1.5px solid var(--line);background:#fff;font-weight:600;font-size:13px;cursor:pointer;color:var(--ink2)}
.cchips button.on{background:var(--red);border-color:var(--red);color:#fff}
.seg button.on{background:var(--red);border-color:var(--red)}
.mcg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.mcg button{min-height:48px;border-radius:12px;border:1.5px solid var(--line);background:#fff;font-weight:700;font-size:14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15;padding:4px}
.mcg button small{font-size:10px;font-weight:600;color:var(--green)}
.mcg button small.alt{color:var(--warn)}
.mcg button.on{background:var(--red);border-color:var(--red);color:#fff}.mcg button.on small{color:#fff}
.mcg button.more{font-weight:600;font-size:12px;color:var(--red-d);border-style:dashed}
.pair{background:#fff}
@media(max-width:560px){.pairs{grid-template-columns:1fr}}
.lt-bot{display:flex;align-items:center;gap:8px;margin-top:8px}.lt-bot .in{flex:1;min-width:0;height:42px;font-size:14px}
.ngs{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
@media(min-width:561px){.ngs{grid-template-columns:1fr 1fr}}
.ngr{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border:1px solid var(--line);border-radius:12px;background:#fff}
.ngr.has{border-color:#E7A9AB;background:#FFF9F9}
.ngr .nm{flex:1;min-width:0;font-size:13px;font-weight:600;line-height:1.25}
.ngr .nm small{display:block;font-size:11px;color:var(--muted);font-weight:500}
.stp{display:flex;align-items:center;gap:4px;flex:none}
.stp button{width:38px;height:38px;border-radius:10px;border:1px solid #CBD2DC;background:#fff;font-size:18px;font-weight:600;cursor:pointer;color:var(--ink2);display:grid;place-items:center;padding:0}
.stp button.pl{color:var(--red)}
.stp input{width:58px;height:38px;border:1.5px solid var(--line);border-radius:10px;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;outline:none;padding:0 4px}
.stp input:focus{border-color:var(--ink)}
.ng-t{border-style:solid;background:#fff}
.lt-row{display:block;padding:12px 0;border-bottom:1px solid var(--line2)}
.lt-top{display:flex;align-items:center;gap:8px}
.lt-top .f{flex:1;min-width:0}
.lt-top .stp input{width:56px}
.tag{display:inline-block;margin-top:5px;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;background:var(--line2);color:var(--ink2)}
.tag.lt{background:#FFEDD5;color:#9A3412}
.lt-rm{margin-top:8px}
.lt-rm .in{height:42px;font-size:14px}
.qchips{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.qchips .qh{width:100%;font-size:12px;font-weight:600;color:var(--ink2)}
.bar-sum{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.bar-sum small{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-sum b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}
.tile{background:var(--bg);border-radius:12px;padding:10px}
.tile small{display:block;font-size:12px;color:var(--muted)}.tile b{font-size:18px;font-variant-numeric:tabular-nums}
.tile.ok{background:var(--green-soft)}.tile.ok small,.tile.ok b{color:var(--green)}
.tile.w{background:var(--warn-soft)}.tile.w small,.tile.w b{color:var(--warn)}
.plist{border:1px solid var(--line);border-radius:12px;overflow:hidden}
.prow{padding:10px 12px;border-bottom:1px solid var(--line2);font-size:14px}
.prow:last-child{border-bottom:0}
.prow .tp{display:flex;justify-content:space-between;gap:10px}
.prow .in2{font-size:12px;color:var(--muted);margin-top:2px}
.prow .ngl{font-size:12px;color:#9A3412;margin-top:2px}
.prow.lost{background:#FAFBFC;font-size:13px;color:var(--ink2)}
/* leader */
.lband{background:var(--red);color:#fff;margin:0 -16px;padding:4px 16px 16px;box-shadow:0 0 0 100vmax var(--red);clip-path:inset(0 -100vmax)}
.lwho{display:flex;align-items:center;gap:10px;font-size:13px;flex-wrap:wrap}
.lwho .in{width:auto;height:38px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.4);color:#fff;font-weight:600;font-size:14px;padding:0 10px}
.lwho .in::-webkit-calendar-picker-indicator{filter:invert(1)}
.lwho a,.lwho button.lnk{color:#fff;font-weight:700;background:none;border:0;cursor:pointer;font-size:13px;padding:0}
.ltabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;background:rgba(255,255,255,.14);border-radius:12px;padding:4px;margin-top:12px}
.ltabs button{min-height:42px;border:0;border-radius:9px;background:transparent;color:#fff;font-weight:600;font-size:14px;cursor:pointer}
.ltabs button.on{background:#fff;color:var(--red);font-weight:800}
.btn.green{background:var(--green);box-shadow:none}.btn.green:hover{background:#14532D}
.btn.soft{background:#FFF7ED;color:#9A3412;border:1px solid #F0B37E;box-shadow:none}
.btn.line{background:#fff;color:var(--ink);border:1px solid #CBD2DC;box-shadow:none}
.btn.grey{background:#E2E6EC;color:#3B4658;box-shadow:none}
.lc{background:#fff;border:1px solid var(--line);border-radius:var(--r);margin-bottom:12px;overflow:hidden;box-shadow:var(--shadow)}
.lc-h{display:flex;align-items:center;gap:10px;padding:14px;cursor:pointer}
.av{flex:none;width:40px;height:40px;border-radius:99px;background:var(--red-soft);color:var(--red);font-weight:800;font-size:14px;display:grid;place-items:center}
.lc-h .grow{flex:1;min-width:0}.lc-h .grow b{display:block;font-size:16px}.lc-h .grow small{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bdg{flex:none;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700;background:var(--green-soft);color:var(--green);white-space:nowrap}
.bdg.w{background:#FFEDD5;color:#9A3412}.bdg.no{background:var(--red-soft);color:var(--red-d)}.bdg.e{background:#E0E7FF;color:#3730A3}
.st3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 14px 12px}
.st3 small{display:block;font-size:12px;color:var(--muted)}.st3 b{font-size:17px;font-variant-numeric:tabular-nums}.st3 b em{font-style:normal;font-size:12px;font-weight:500;color:var(--muted)}
.lwarn{margin:0 14px 12px;padding:8px 10px;border-radius:10px;background:var(--warn-soft);color:#9A3412;font-size:13px;font-weight:500}
.lc-d{border-top:1px solid var(--line2);background:#FAFBFC}
.lc-d .prow{background:transparent}
.lc .lc-d{display:none}.lc.open .lc-d{display:block}
.lacts{display:flex;gap:8px;padding:12px 14px}
.lacts .btn{height:48px;justify-content:center;padding:0 10px;font-size:15px;flex:1}
.lacts .btn.main{flex:2}
.ldec{padding:0 14px 12px;font-size:12px;color:var(--muted)}
.missing{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:14px;margin-top:4px}
.missing h3{margin:0 0 10px;font-size:15px}.missing h3 span{color:var(--warn)}
.missing .ch{display:inline-block;margin:0 6px 6px 0;padding:6px 12px;border-radius:99px;background:var(--warn-soft);color:#7C2D12;font-size:13px}
.lrow{display:flex;gap:10px;margin:14px 0 12px}
.lrow .btn{flex:1;justify-content:center;height:52px}
.lg2{max-width:820px;margin:28px auto 0;display:flex;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(16,24,40,.12)}
.lg2-l{position:relative;overflow:hidden;width:44%;background:linear-gradient(135deg,var(--red),#4A0B0D);color:#fff;padding:36px 30px;display:flex;flex-direction:column;justify-content:space-between;gap:24px;min-height:380px}
.lg2-l h2{margin:0;font-size:24px;line-height:1.2}.lg2-l p{margin:8px 0 0;font-size:13px;opacity:.85;max-width:240px}
.lg2-l .k{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.7}
.lg2-l svg{position:absolute;right:-60px;bottom:-60px;width:250px;height:250px;opacity:.9}
.lg2-r{flex:1;padding:40px 36px}
.lg2-r h3{margin:0;font-size:22px}.lg2-r .s{margin:4px 0 22px;color:var(--muted);font-size:13px}
.lg2-r .pinw{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:12px;padding-right:10px;background:#fff}
.lg2-r .pinw .in{border:0;box-shadow:none}.lg2-r .pinw button{border:0;background:none;font-weight:700;font-size:12px;color:var(--ink2);cursor:pointer}
.lg2-r .ft{margin-top:26px;text-align:center;font-size:11px;color:var(--muted)}
@media(max-width:640px){.lg2{flex-direction:column;margin:0 -16px;border-radius:0;box-shadow:none}.lg2-l{width:auto;min-height:0;padding:24px 20px}.lg2-l svg{width:150px;height:150px;right:-40px;top:-40px;bottom:auto;opacity:.3}.lg2-r{padding:26px 20px}}
#revOv .sheet-f{display:grid;grid-template-columns:1fr 2fr}#revOv .sheet-f .btn{justify-content:center}
</style>
</head>
<body>
<header class="hero">
  <div class="hero-in">
    <div class="logo"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAABkCAYAAADQUT//AAAQAElEQVR4AexdCZBcR3n++s1qV7JkJNvYsvaQRrYcjMMhm/sKVjgCgRApYIzBsaXYBltgtAIKE8CHLDvcWK5U2UoghVxJVYqqFCaVQIgDkSAhoYjBSkEcIDaaPSTZFsaysXXsMZ3v63399s2bmZ17d3bnTfU/3f33f//d/fq9mdkNkL7SCHRwBNIF0MHJT10H0gWQzoKOjkC6ADo6/anz6QJI50BHR6CDF0BH5z11PoxAugDCQKRVZ0YgXQCdmffU6zAC6QIIA9FIZfk07Qiec+oh9J4ygv4lB5Bd3Ag8hjOXPY51z2rEpoXGawHzMM5Z/ghWLq03tsrN44yraoQvtwAk8CDWPocDzx/GwLms181TOO8wVl+Qw5pVoX8tryxgDiP7hpM4fqtF90czyGzvRv6DhG31gf3AOJZ84jjGdhzC2jfejxctQvhiTpYoT49g4HmtzJN0jCK7nvqer7kRqp+zygJdo1jz5sWYvG0SSz7aDXt9N/K1xveDGXQNnsDETtbbDuLcATkUUHimB/n3AvlvZZD55wyCfwyQmYfQ9U3a/U0L8+1FMPdw8qyRg62GX+KcZ1nYGw3MoIH9uAVuAsxOwq11wA4AOw3MhwmDlPv5lfj1c4mDFkKGCWSe7ptE8E/M0zfob315Kp9fyfyGdBjY71D+X2cw2Sf9cwmjWHtBANxOG94P2I+xrie+OxnPm8gvGczN5FXMVSY4gjOXWJgNFJq1gC6757P9nPkH9jzavI4+cPe3r8ojfy77LS9LYXoMcDYVHaPuMdZg39QJzDO6Kec45RxlsrKE09nGmTiyjAl8HdurCWcQWpEjxVAbh3ZH6f3fpeg5Ql1zXPL9NOAcwhOEk4RFtcaXPIptF+tfM76LWD93FP3dwQQW5Q3MU0QQj0xYqz0fIR/af8LAKlDstracxPg4A/UMtSwJQRO4i7i6gDIM4RTCMsKTXZiUbCxD9yRlPkmcimjYRbNhnMJ7CCco+JMG41edgYc0N4iau8KZy80AguV0fDEAQ/tqii/g5rbmtzZ5dvFIP0bHA15OLXeWSWIMQStE9XwFxkobMD1xMVLdWshDp0g3ERUzr1/tRkBylKxJyp+QB3lkbACjPMlBjTUivxSv1HTz7RA3j239GLq9F4eOsT/nJUBem4zikLFwX98xNKouIFNAXharq3U+7LCflnaLAHNtA4O8JnsrbaMeaGFxbmA/N8MrejH8pVYqrFX2JIIuGqc4yFZBrSKK6OmnNvsgXQBFoekohCaTjo2aXL/Iw2zvx/B3FnIEkr6lCyAZkc7qa+fPcHfdZ2GuHEBuX2e5D3ee6jSfU3/h7lksA6FjwI8nMXlNP3I/YL/jSnoF6LiUu8kvrw1gfsJ7jMEBjD6EDn2lC6DzEq9HnZz8eJBn/qt7MfJvnReCaY/TBTAdi4XeytNBnfn1qHO/QXDdAA78EB3+6qAF0OGZnjr3hze8mUt7ceB7HR8RBiBdAAxChxQ96vwx73w/1I9f/qJDfK7oZroAKoZoXhPoyMM5jxM89N8NBO/uw9AD89qjJhufLoAmB7SNxGnia9fXd4huP4Rnb+vDgZ+3kX1tYUq6ANoiDU03Qje8An0h8E/7MXTbi/EjPf1puqL5LjBdAPM9g8X269ijvE4A5tM88nweSF/lIhBkkNdXS/X9aNEwaO6DEl0+qwXxtRKqtUN02vVU0x5r+NZpRf7r2MOd3958GGfoRySdFoOa/NXXoRdzpugHHZo4+vqragVSO0k1IPqalFZJLLmyQ1DRDvqgxavLvH5M0mMQ6Pv06KCX4iUYYyxu7cPwZ9JjT+XsB/0YfQow/wHgOAN3KuunCVoIJ1iXA00yD5qcJG16UTKlXz8IkS61ywKJueu5r/XqBxMj/Ih/pOkWtalA5k0LnxU0+Xf0YujP2tTUtjMrYNQmxmF3A+ZqTqKt7G8WWNgt5UDjhCsNzDsB8PEaNPnYbEqhGU4OP600n6COSw1wZTlb4njA/ImF0W89t56N4U554mEtoCPsmIX5xCoMfQrpq+oIBKLMYuhwH3J/24ehL3P3uJfwtX4M/1050DiBdLlv5RF8mTIeJzSlcLLrKKNHd1/rRW4X4Vu9GLq3nC1xfB9yX+1Hbk8/hvZSTquuTE3xsxEhFvpRGPSSj3QVRyzMx/qRu4MdO4K1LxjFmttHsfqtFhEtOvFVyWe3ACoRzTROAScZdB1RZiKreowJY8FkAPtY1UydR6if8ylOuuH9fgBziSa/wnAI2TcFyH+VOfm4gbnhUazU74s1lEKJCAQlcDWhMphYxGOIvmBVE185YgO3Y3XlYfyPl5G+piKQh3X5Yoz8mf/bbFyyCrnvioI7/hXMxd+wrb/soXun8yfQ83L201ImAi6gZcaqQvP+gfnQXwGpijwlqjMC4/jNpIHVD1h0POTDCntfF4LLszy+6m8GHcKazxsY3Y/pT6boaLSIqp5N3I7HkNVTPnbTkoxAwwsgKTDttyYCY1i03ACrKF3Hnh9aTF61Egce1eRfhcd3WuDDHNOfNNHkF42uykTjVbxKXMuxtJSIQMcvAM4QIygRmzZByTygG0G3RfCohfkvg/z1/Tg4egDZxZz8twF2kMZaAtcIMqx90WIg3l5zGNnXemRaT0dgAS+AaSfLtYYxcO5hrNnB4wMfn7bn76MnkXET+iTso3lMfCiDrrf0YuR+zuqgG/ZznPwfpX89BJVkPh0vB3ot8u9iPevlIM4dOIjsZ0aRbct7kWTAZj1Ac6mwC+Z1nEicQPaKHLJtedNtMHXjuxa5EwMYfWgVHjoygv4lXLSfZuw+QNAuLzBsJ4vH8bMC80eHsPrVSYJW9w3GL9YiDWAvabWueuR37ALgxDcWRn8Lswcwa7phVmIevHTmN+jSh10fobmWkAmBVcmiRSC6s/IIvniQO3JJqhYhLYzb+S3wCl5xe1ukpm6xHbsAuOMvZ9SUHOYGnBz5WfljutRZd9GZvxe/uolXhetrFKI86ynSS3jz/NYaeesml72Y2mQU45dmELwbbfYK2syeWTOHx5/forLfJhwnLMnAXDqVMPbaqGQwqeONvqJretyfsccNNE9506TS7s5u5ULC/BSVvfQQep891W7t+yLk38njz8upe4Ig/TyGzY7uaj1TIKulXTB0j+HMZQHy19AhXQVYMU2w7+gG/tB12ujNwmjiYBT9p7H9Zgv3vZ8TNDEglC4lsOTLCM2J+Oo8uj7Efk384q0FfooLugOYLeQ5lbr0l5zlx0V5dL+FuLYpQdtYMouGTOCUN1LdewjyX98eVXL0lYF3M1luonCsTcr07xo4eSdDo9gMW9VX8pXuIWNgrnoE2ddUz1o75XIcX09lF5BTNhvWimsPN56XE9/FflsUBaUtDJlNI5iAV1Cf/p6/kuNiwAyN8zrwMj4p0X0Bh9urLMbScQvzjKyirc5mtWsF8tJP3fPYG3kU0qKvVURFegs9u9XxB2eRmF2+E6d3C/M7IxgQXt05h7oDOeeW12mAjj9k9Te8lm0VPhFy30E608C8XYh2BANnIxp4yU99RUJXPJ7NF7XkwzFO8CwD+/uhnX6O0XxI7+oAwYXh2JxX3rg5N2S2DBjDkjczE78b6vP+E4UMcQET1xb/GI62tKzQWV35luaBax7ByqXNVsTzjR53ZkO5VBe24BbAUiIu0z1ChJ3Dhp8Ac2jC7KnWJT+A2cxJ7m9+g5h25sX1LupG/kWutUDf6L8WOyu8bRKLtzbfzeD3KNPfW/m4EhV92v62FXh6oxDNhlrlxSdArbzzkL7rImZdZ3ztgGwWuSD86RbBJe34SLTI2voRyrsmphbC5kewZm39ogo5R7Fan65fTaziK2AzKl7vqQbB29vhKiCD0AkvZoKP4oy+D3M6M5+nz6z4XqIY2Et4GX9hiaGFhGJIMEGHnjsJ+152ysaDNFWXAMEVJPafqmfYThaqEsqedwaO6aikzpxBxyyAw+hdwSi778IwA+X89vheg/y7SNeUSUG97VjkmyYoa/OBg8he2aiRD+Oc5Rb2eaEcH8uwW1DpSrvKwv3704KB2e7MZORs29JSfXl0vZAK9L9mWbkbXtVJ4GRwf1mCD9/Na4axWosmSbOQ+oYO67HoMgN7wwj6n9+Ic0sw/gLK028WdIWdSRT3FpwGBK9mY07n4JwqnylCzR4Lph5vnkq5E4SZiuGgEng2nxf6BUPUwiycgLoKsML5ATK6ea3b0TyCl1jgLAZQO3w5ORx2G1CPhb3+MFa/shzhbOCD2VAyOzrKaxnFmlcwMdV+BK+YCPoszHUWUMKwgF/y1fv4Pv1FiXp85dVjHYXo/J9hzCRzJjEkxRgJeu3UU7kM23NSKhk6J0Y1U6kFeD9rLqXM1QR21Wdr5qIEiXbjKNa+ZGbSBTOqK+O6APnb6/lswCDzNgA6Zipu1UzogPQqrzqEtevUmAvwRsyF7lnR+ShWr+Zs9p9KslmdWhJqQpzBCfEOZpSLqDq+eUylSauj3xsmsPiltfhxGOv4CTo2kYehch92sVmx+Lm3zmLyZRWpW0TgjWiR+LkXOwHDTySt/iqCzqVKUI1GmTdxh/JfnaiRd16RG1qrBdAT8OgXfmWEqMrFYuxNpHoxQfySw2bFEpBC+egKYNazPSclmBOts6RUv54C7B9Qnb70ZVgLWFUuzIx2RBLac/PId8ICoK9Tx0PenG4awynvE6IasDD6TpE++dV8ElTD5mmsBTYMY2BOYlyrsd7oeVGvxOMXGRg939ZkrtVX0TM3OIXMr29rh5trnHzuMsB7HkNWV84ZpU99mmv101LRkU1V1SB66VufQTA4Jatq3qYQBo1KMVgU0ItMo3I8P6PhLqN8Lt2wTNp1GeXyebN7ts9mfcXCvD6HNXq+XSSgCxOKob9HsEUE9SMYByPZTsJTGA+4Mzs9VMIxh27V2wkKvnAC9ibqYhjZK1NOwzN/DBh9d4qkqOflfXzr6TheMsZTQt0fB2jYbxqpozAMTOZHeNF0gKeU1P5ukPePvSjbfbQuI+sB8YtPP1E0FqandmumOQ5izSsNrL5wpWSOcUSy5XzVYOD8OWZgz18E+0GLqSMCZUWFYyRzX/LisFtoki9d9YJky159QNWTR8CPI4BujGU4oN8wWNYaV12vjpn4JFc6T7JxxWFky342cBgDekJ2I+1RrmSTfK8HjlPGWVzg+p4Wm0WFfrv5oFwqLiKYyYdSY3QHAtkp/lOW48kgUKsRyCAvgROUoYmgHUoy6wHxi0/f1JShz1BmI0UfsKyhANnGyk1S6agWtLA16bgY9TNEw8lwTq8ExWEci5RwJUZy5b945Ee9IPE6TzPpOBbAKr5Y7H4QA8VEek4lkep6dVTikw/d1KGvTG9iMqSL3elCXCaP4L3EKMbHWMt30dUDWgD02V7OzxPkN8XFi5F8xXgpsX68kg/JcW+XYseVYJ5eh4cmRUSZ9ZeVGPkZbzSvI9xA4C5p0pzeOQAADT1JREFUtlrUB7Ti/bTyNvJv6UKX/sgrUfUW83+A+QkA/YvQo6yHCCM1gOhHaY94nyLfg3mc1ARkc7pkkXsygNlO32/g1WCQttftf8irD98+AphbLbD5GXT/FHydiZ//hno+KR0G5uMW5lpCo7pK8lPd1VM6cGOAyS8ZOkdcQckhq6uEJq5iol15lAS1xDdOG5D3CGAenECXReJ1HF0P0AT9/wodyT5s6/ddsb2ZMXyfQeYL9MudX9HIS0L6MPwPhM8S/rwfubvrhT4M3dWLoZvIf8/ZePixRuw6jDO+GSDPewB7WR64nE7XAfnLyfsewmUGRn+O8PGkTYaZWYXcd/sw/NleDN9J2+v2P+Td3Y+hL/QhdzPrvefhoZNeZy9yP+ulDtaf6kfuLwiN6irJ34ehv6KOT/dj6LZejNzv9cdrLvyTAcwXAaP4XFFffG2YE7MlALYYjH1uLXLa6RF/KQZ9GP4X2rOT8MX+mO9sl/ShDF6x3dmL4b/sw8NagO5YENe1YNr6/1irMPw/T2DZ945i6b+z/YPaYeQ/yfv9CZh/7UWOV7oFE56GHdHCPxu5oTwm7gMm967CcB3xneIBxu6bwOS+Xhz6VcOG1SiAC69GjnlG/jw8OCZgwvS3aWoG8ZbaleZZGFpiLmNqBzB6XMB2zbH1PJz4xySjJUZWELrgF0AF/9PhDo9AugA6fAJ0uvvpAuj0GdDh/s/jBdDhmUvdb0oE0gXQlDCmQuZrBNIFMF8zl9rdlAikC6ApYUyFzNcIpAtgvmYutbspEUgXQFPCOMtCUnVNi0C6AJoWylTQfIyAWwBbt25df+21115cCrxTHMsSStIk8Nl6eSgn0jE4OFjwR6nU57jTr7bX4eu4D2p7vGrPl8SHY5FO9ZMgXeTbTBk3C9QWztMRF/Gz7ewrU8fporaXE69L8VPv+gRNJEP2xHii+Ht6jkW0iXaBvZLjeZK19F933XWD5HdxYHtjKRqOO5nJMfX9GOu4PY6euFK180V2UX/ZHGjc86stXR7IF81tj4vXbgFYa+8wxuwtBXTUEu4g05WlxpM40RF8qYmHsiI7Tp48udkLUX3ixIn1HHc2qi2cBzq5mT48EI7f6/GqORbxkWavcAmIbEzgQd7NtOMA+b5C2bcI1CbuCY2F9BE/x519pWrSRnSJNrvThYmULi9H8RDspV7lYJoQiOQpHjGdBf6HDBEt+1E7xuP0yS/pj08itZl/6X+AvLLFxYHte4l/ghAtBNnoZcbxpHXFj7FT1gZPo1p0ijPtmjEHcf/VJl9UaJPzTfIoq2ATEZFbAGqEcJT1vhiozy4GKUATstSYaCJ8EAT6Hj30CtvRGHGiZQXVEV50DLxWexRMANsIFQud0uT/Skh4lHZuuOuuu/aHfeTz+bicFaL3YzPVsofBk1x/JfL2OjaNkeZi15l+8zSl6mmqMi3K0+RXnEWxv6enZwMbihWrqot2vJurpI7bmRMP46dFv1cTX8DJp03D+ylbxOPjq9jcWyamXxG/ZFYA6ZXMUgDFmfzSwwqeBnppjDHztglVAKFdnjc5FxxtcgHsv/vuuzd4YAL0Z7NloCP2eNVE+CAU8HDy7eGYK2qL1gORM/Hox+skgYIMvrJ0oGjFEh8V7TIKQogomvxKABPqF5WTS/qq/hFejA9sX+h9UDvUp8rbrDY8TanaEczwRl+0uxZM/l27djmbZ2ArOUQbdVTRhlJy3CMTdq4l35ZwbD130m0C9l0OGLc9pD+NoPlxIWn1X17c3ODYHYo1aeNlBRdPxYVIXsmVzCKgjie9QLZdDqRfbY9nXZAD9qNC2X7MxZF8fi5ENMkFEA2ooQRQiJ/QFQMqnnqBxrnkU9/XKcMFNrF7Ez1dwsWhHVrIoskv5NjYmBx2OwDl7hKOsJG7RkVfSK+fZpIc2jmcDHW4qPfT1i0cv4VXru8K1yjQF/k+GMpxO79iH/brqVbQRh+bqvnp2x765fJNfl31vU37du/e7ReHk0fa/aT1uBVhrN1Y7E0LsewOHaMr2aT8unMQ5tjpphyf+6ITwIwLQFYxEE4I224VsW56obHS4SYlJ9WdVCDQzruxxM4i/Ho6pUuzn5hblBDyFRTS+B3g60zgDg56HzyeqLLlHj/CGOzlDv0A4Q7CRuraI3mqPY1q+uFuEEvU8k8kRaDJTzujycqr7oYGJ7+/yl4sW4sUVkDQ178PSRRbgeIdxSIccxVjoCOJ36xe65BTb8K5WFNe8t5liiJ857hufkvGjSSRXtJVlQPy+OJzfJR2KvfaWHWk8nhHl1wAujuPjGEAdePjk+d2BsfV/DdvVI6TSjuLM5Zqyu0sCqpLDmlUPL/aDjgJtaCc7QyeSyonmpPLvnZcR1fujUHLkc7vcCLTUUA7orv5o/ybhYwD6d0NYrImTXxysDtdaFM0+YXlsaGibaKbAZRsTUCRVHsOF60D2uMmruuEb7wSe3khpqByY/RZ8fYDwskO9Svdk1xM3pJxqycHUiigTBdH+uNz7uYAx7TgIluLFgAZI2NIrKSzwj7uTN4h9ZsG2uGp0xvrFpkcpwLtLlqx8ZtYoguKoyFmIxerjjtsThXK9HxHu7u7XRA44neUbJKeY0WFi1FHAt0H6RLqd1bR6YhxC2VoIarvgMG+pRRwsNJRSZPOy9cGFCWIvDUV6pes7SHTCp7jC2wM8S2veFaPYsZc3MINo5xP+2hzubih1hzIMeZFc8HrczkP54BioyuanxtFvwnOxY2hsO003t18NHhZpqjSJXF2jK5AMWrtIN6ZCE27tnBRbiJCuw0rJHc7BUH4o5wE25gA7djRTkw/q7oZ1mJkMrcTLqS+06SXQv1k1RUhso20O8qAX6hkLSru/iWUq0EtroKrgpC1AG3Vghco2Zsp210Jq5FB2viV1bEQ5zdC10+8uTHG0+chGiZfdAVlu6RP5NtXJmbRhsvxHH0qmwMem6McSDllxnP7WuVec4BjbgGw9nOjeAFQWZREKt3FFeiTTb7mFxobrUYGSclyVyBqipJG/DaAmOmyiXbt0aIkvw+ynjq4ICd2gCz5nUzVXgTbm3X18f1kTRk6cz7B4DmZGpc+6aVOv8NqghUEX3S1ABfVWsrcL6DcW0Jend+1uMJu7RVlyUaf8CiWVUjym4R4BWKJTyj1HTA2kusWDOP53w4Ze5NP7OpKwAqiRS2vanPAI5r+NpETTTu0gbgThRDsx3PvcxWdAJJHIPHUBQpGCF5JRTm8AdTuIdBRR8eNgkshBfidM3KIONH6xIALVjQ+yP4o5O8JCq5onBROvmQIKpy3pcMFU36JPgZevmwp2vlidBWbWlSeiL5o1/MbTkNHIcqSXZLnxVesQz9drBmrXYKQSefmgiuscsfJ5T90O8qF7I6vIX1UES8bZEuEq6FRVQ54BYg+e6LseG5cvulHVHPc2+LomrYAGAz3iRsVOMGsKxYaFtEuXrx4O5MWXX3UpgD3NIi1JmLJXYhjCIOsYKmrHdtf4tzTH8mKA4n8JIv0E1dQaJvXrV1eVwM9BVL9BH11k4QMWnw+oAh3LNEUAXncQifPjIV6tXOLRj7LF7XrAl3BySgbWRWXhL3uk3RSaUffz3zcKWDfxYr26wOyAyHPA7RTD0hEq/hsjy9k8kRFeNL6q3SE9w3JDWUWxYw00WZKOo2XzAGvAFEOyONzv3/37t0F80l9jrujIWv3hLFpC4AC6yl+In1dgUoKYAJlrJ/YnjZJhpDXB9klRUQMmrsBUjsBHq+vSZScmAzWPvJLptcvOl3GvXw9GNA9SFy0xsuB54vTF7Wll0h/RfOyiKqv0Ae/oEoJ8PJVyz9d0fZwQ3GPYhVXtcmoPLCCfIhoASg27jiKGV6hT15GklKTXDJLge6Pas2Bl+9z7PuuZjwivE4AbgEQuZ2rdINqR1XFm2jjPGoLyBopYLugxHkGBwdXkH4TYQOhbJLIo3GBp93AncntSnHhWiyUI7oIwjNonMy1mVQdtzzdnZ7PDcbeyK/JoKdA0u0uoxxOPhi4x/PPVNMPF2PRUEbEw3ZRoX07RBcH8ScIIxmKh6dVO05HH/TB3YV+nGMRn8f5mjE0nKxbNPFJ54raxMt/xUE++DhsIl6fDEcTWzZKlmrHHHujT/rw0MWc6LI2iN+D5ND+ijmQz57H19RX8khGeXrM7uyg/H1uAQhJx/eppnFVFdHGedQOIX45KpAV51FgQ3o9BajIE6PdJ94CwWEnTqN2iC6qxK/xJBQREiFaJjo6SrFd8GCAMnIE+TAjeN9D2oiHKoqKdIZ0UzJ37y7KDccjGXF6tZMCy+mmjEi+2km+eJ/jehKzi7U7VjAO0cT3dF6Pao/ztewir9cX2R7D+bGo9nLEK32k9boLcqBxjkV8agvndSdrjQsk3y2AJEHaTyPQKRFIF0CnZDr1s2QE0gVQMiwpslMikC6ATsl06mfJCKQLoGRYUmS7RKDVdqQLoNURTuW3dQTSBdDW6UmNa3UE0gXQ6gin8ts6AukCaOv0pMa1OgL/DwAA//9YMHJmAAAABklEQVQDAH2VyqrT+RwGAAAAAElFTkSuQmCC" alt="Takai"></div>
    <div class="t"><h1 id="hTitle">Laporan Produksi QA</h1><p id="hSub">Quality Assurance • Input harian</p><small class="ver">%%VERSI%%</small></div>
    <a class="mode" id="modeLink" href="#" target="_top" style="display:none"></a>
  </div>
  <div class="accent"></div>
</header>

<main class="wrap" id="app"><div class="loading"><div class="spin"></div>Memuat data master…</div></main>

<section class="done" id="done">
  <div class="ck"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
  <h2>Laporan terkirim</h2>
  <p id="doneMsg"></p>
  <div class="row">
    <button class="btn ghost" onclick="newReport(true)">Laporan member lain</button>
    <button class="btn" onclick="newReport(false)">Tambah laporan lagi</button>
  </div>
</section>

<div class="bar" id="bar" style="display:none">
  <div class="bar-in">
    <div class="bar-sum"><small id="sSum">0 part</small><b id="sSt"></b></div>
    <button class="btn" id="btnSend" onclick="openReview()">Periksa &amp; kirim
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
  </div>
</div>

<div class="ov" id="pickOv" onclick="if(event.target===this)closePick()">
  <div class="sheet">
    <div class="sheet-h"><h3 id="pickTitle"></h3>
      <div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input class="in" id="pickQ" placeholder="Cari…" autocomplete="off"></div></div>
    <div class="opts" id="pickList"></div>
  </div>
</div>

<div class="ov" id="revOv" onclick="if(event.target===this)closeReview()">
  <div class="sheet">
    <div class="sheet-h"><h3>Periksa sebelum kirim</h3></div>
    <div class="rv" id="rvBody"></div>
    <div class="sheet-f">
      <button class="btn ghost" onclick="closeReview()">Ubah</button>
      <button class="btn" id="btnConfirm" onclick="send()">Kirim laporan</button>
    </div>
  </div>
</div>

<div class="ov" id="edOv" onclick="if(event.target===this)closeEdit()">
  <div class="sheet">
    <div class="sheet-h"><h3>Edit laporan</h3></div>
    <div class="rv" id="edBody"></div>
    <div class="sheet-f ed-f">
      <button class="btn ghost" onclick="closeEdit()">Batal</button>
      <button class="btn dark" id="btnEdSave" onclick="saveEdit(false)">Simpan</button>
      <button class="btn" id="btnEdOk" onclick="saveEdit(true)">Simpan &amp; setujui</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
var M = null;                 // master data
var S = null;                 // state laporan
var uid = 0;
var DRAFT_KEY = 'qa-draft-v1', MEMBER_KEY = 'qa-member-v1';
var IC = {
  chev:'<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  dn:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  copy:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  del:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  plus:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  warn:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:1px"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'
};

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function $(id){return document.getElementById(id);}
function n(v){var x=parseFloat(String(v).replace(',','.'));return isNaN(x)?0:x;}
function fmt(x){return (Math.round(x*100)/100).toLocaleString('id-ID');}
function toast(msg){var t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove('show');},2600);}
function cat(name){for(var i=0;i<M.categories.length;i++)if(M.categories[i].name===name)return M.categories[i];return null;}
function partOf(c,name){if(!c)return null;for(var i=0;i<c.parts.length;i++)if(c.parts[i].name===name)return c.parts[i];return null;}

/* ---------- server ---------- */
function call(fn,args,ok,fail){
  if(window.google&&google.script&&google.script.run){
    var r=google.script.run.withSuccessHandler(ok).withFailureHandler(function(e){(fail||showErr)(e&&e.message?e.message:String(e));});
    r[fn].apply(r,args||[]);
  } else { window.MOCK[fn].apply(null,(args||[]).concat([ok])); }
}
function showErr(m){toast(m);}

/* ---------- state ---------- */
function newItem(category){return {id:++uid,category:category||'',part:'',type:'',mc:'',normalQty:'',normalMin:'',otQty:'',otMin:'',mcMin:'',mcOtMin:'',lot:'',oiban:'',ng:['','','','','','','','','',''],ngNote:'',open:true,ngOpen:true};}
// Posisi NG "Lain-lain" di grup NG kategori itu (-1 bila tidak ada). Isinya wajib diberi catatan jenis NG.
function lainIdx(c){if(!c)return -1;for(var k=0;k<c.ng.length;k++)if(/^lain/i.test(c.ng[k]||''))return k;return -1;}
function newLt(){return {id:++uid,type:'',minutes:'',remarks:''};}
// Lost time harian yang langsung terisi di form baru (masih bisa diubah atau dihapus).
var DEF_LT=[['5S',10],['Briefing Pagi',5],['Input Laporan',5]];
function defLost(){return DEF_LT.filter(function(d){return M.lostTypes.indexOf(d[0])>=0;}).map(function(d){var l=newLt();l.type=d[0];l.minutes=String(d[1]);l.auto=true;return l;});}
function freshState(keepMember){
  return {date:M.today,member:keepMember&&S?S.member:savedMember(),items:[newItem()],lost:defLost(),op:{min:'',ot:'',auto:true}};
}
// Part di mesin (bagian PF): menit yang diisi adalah menit MC jalan, waktu operator diisi sekali per laporan.
function isMc(it){var c=cat(it.category);return !!(c&&c.machines.length&&it.mc&&it.mc!=='-'&&it.mcMin!==undefined);}
function mcItems(){return S.items.filter(isMc);}
// Menit operator untuk part tanpa mesin (normal / OT).
function nonMcMin(k){var t=0;S.items.forEach(function(i){if(!isMc(i))t+=n(i[k]);});return t;}
// Waktu jaga mesin otomatis: sisa 480 setelah lost time dan part tanpa mesin; OT = menit MC OT terlama.
function autoOp(){
  if(!S.op)S.op={min:'',ot:'',auto:true};
  if(!S.op.auto)return;
  var mc=mcItems();
  if(!mc.length){S.op.min='';S.op.ot='';return;}
  var lt=0;S.lost.forEach(function(l){lt+=n(l.minutes);});
  S.op.min=String(Math.max(0,M.normalMin-nonMcMin('normalMin')-lt));
  var ot=0;mc.forEach(function(i){ot=Math.max(ot,n(i.mcOtMin));});S.op.ot=ot?String(ot):'';
}
function opMin(k){return mcItems().length&&S.op?n(S.op[k]):0;}
function workMin(){return nonMcMin('normalMin')+opMin('min');}
function workOt(){return nonMcMin('otMin')+opMin('ot');}
// "1-6, 8, 10-12" -> daftar oiban satu per satu (sama dengan uraiOiban_ di server).
function uraiOiban(text){
  var s=String(text||'').trim(),list=[],err='';
  if(!s)return {list:list,err:err};
  s=s.replace(/\s*(s\/d|s\.d\.?|sampai|~|–|—)\s*/gi,'-').replace(/(\d)\s*sd\s*(\d)/gi,'$1-$2').replace(/\s*-\s*/g,'-');
  s.split(/[,;.\s\/]+/).forEach(function(t){
    if(!t)return;
    var m=t.match(/^(\d+)-(\d+)$/);
    if(!m){list.push(t);return;}
    var a=+m[1],b=+m[2],w=m[1].charAt(0)==='0'?m[1].length:0;
    if(b<a||b-a>500){err='rentang oiban "'+t+'" tidak wajar';return;}
    for(var x=a;x<=b;x++){var v=String(x);while(w&&v.length<w)v='0'+v;list.push(v);}
  });
  return {list:list,err:err};
}
function oibanInfo(text){
  var o=uraiOiban(text);
  if(o.err)return '<span style="color:var(--red-d)">'+esc(o.err)+'. Contoh: 1-6, 8, 10-12</span>';
  if(o.list.length<2)return '';
  return o.list.length+' oiban: '+esc(o.list.length>12?o.list.slice(0,6).join(', ')+' … '+o.list.slice(-3).join(', '):o.list.join(', '));
}
function savedMember(){try{var m=localStorage.getItem(MEMBER_KEY)||'';return M.members.indexOf(m)>=0?m:'';}catch(e){return '';}}
function saveMember(m){try{localStorage.setItem(MEMBER_KEY,m);}catch(e){}
}
function saveDraft(){try{localStorage.setItem(DRAFT_KEY,JSON.stringify(S));}catch(e){}}
function loadDraft(){try{var d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(d&&d.items){d.op=d.op||{min:'',ot:'',auto:true};d.items.forEach(function(i){uid=Math.max(uid,i.id);if(i.mcMin===undefined){i.mcMin=i.normalMin;i.mcOtMin=i.otMin;}});(d.lost||[]).forEach(function(i){uid=Math.max(uid,i.id);});return d;}}catch(e){}return null;}
function clearDraft(){try{localStorage.removeItem(DRAFT_KEY);}catch(e){}}

/* ---------- render ---------- */
function render(){
  var h='';
  h+='<div class="band"><div class="idrow">';
  h+='<label class="idc" data-k="date"><small>Tanggal</small><input type="date" value="'+esc(S.date)+'" onchange="S.date=this.value;this.parentNode.classList.remove(\'err\');changed(true)"></label>';
  h+='<button type="button" class="idc" data-k="member" onclick="pickMember()"><small>Nama member</small><b'+(S.member?'':' class="ph"')+'>'+esc(S.member||'Pilih nama Anda')+'</b></button>';
  h+='</div><div id="existing"></div><div id="hist" class="subs"></div><div class="meter" id="meter"></div></div>';
  if(S.editId)h+='<div class="notice" style="margin-top:14px">'+IC.warn+'<div style="flex:1"><b>Sedang mengedit kiriman '+esc(fmtDate(S.date))+'</b> yang masih menunggu leader. Simpan untuk mengganti kiriman lama.<br><button class="btn ghost sm-btn" onclick="batalEdit()">Batal edit</button></div></div>';

  h+='<div class="sec-h"><h2>Pekerjaan produksi</h2><span class="cnt">'+S.items.length+' part</span></div>';
  S.items.forEach(function(it,ix){h+=itemHtml(it,ix);});
  h+='<button class="add" onclick="addItem()">'+IC.plus+' Tambah part</button>';
  if(mcItems().length){
    autoOp();
    h+='<div class="sec-h"><h2>Waktu kerja operator di mesin</h2><span class="cnt">'+mcItems().length+' MC</span></div>';
    h+='<div class="card"><p class="hint" style="margin:0 0 12px;font-size:13px;color:var(--muted)">Isi sekali saja, berapa menit Anda menjaga mesin hari ini (bukan dijumlah per MC). '
      +(S.op.auto?'Terisi otomatis dari '+M.normalMin+' menit dikurangi lost time dan part tanpa mesin.':'<a href="#" onclick="S.op.auto=true;changed();render();return false">Hitung otomatis lagi</a>')+'</p><div class="grid g2">'
      +'<label class="f" data-k="opMin"><span class="lb">Normal (menit)</span><input class="in num" id="opMin" inputmode="decimal" value="'+esc(S.op.min)+'" oninput="S.op.min=this.value;S.op.auto=false;changed()"></label>'
      +'<label class="f" data-k="opOt"><span class="lb">Lembur / OT (menit)</span><input class="in num" id="opOt" inputmode="decimal" value="'+esc(S.op.ot)+'" oninput="S.op.ot=this.value;S.op.auto=false;changed()"></label>'
      +'</div></div>';
  }

  h+='<div class="sec-h" id="ltSec"><h2>Lost time / Another job</h2><span class="cnt">'+(S.lost.length?S.lost.length+' catatan':'wajib bila waktu kerja kurang dari '+M.normalMin+' menit')+'</span></div>';
  h+='<div class="card"><div id="ltGap"></div>';
  if(!S.lost.length)h+='<div class="empty">Belum ada lost time.</div>';
  if(S.lost.some(function(l){return l.auto;}))h+='<p class="hint" style="margin:0 0 4px">5S, Briefing Pagi, dan Input Laporan sudah terisi otomatis. Ubah menitnya bila berbeda.</p>';
  S.lost.forEach(function(l,ix){
    var grp=(M.lostGroups||{})[l.type]||'';
    h+='<div class="lt-row" id="lt'+l.id+'"><div class="lt-top">'
      +'<div class="f" data-k="type">'+pickBtn(l.type,'Pilih jenis','pickLt('+ix+')')+(grp?'<span class="tag'+(/^lost/i.test(grp)?' lt':'')+'">'+esc(grp)+'</span>':'')+'</div>'
      +'</div><div class="lt-bot"><div class="stp" data-k="minutes"><button type="button" aria-label="Kurangi 5 menit" onclick="stepLt('+ix+',-5)">&minus;</button><input id="lti'+l.id+'" inputmode="decimal" placeholder="mnt" value="'+esc(l.minutes)+'" oninput="S.lost['+ix+'].minutes=this.value;S.lost['+ix+'].auto=false;changed()"><button type="button" class="pl" aria-label="Tambah 5 menit" onclick="stepLt('+ix+',5)">+</button></div>'
      +'<input class="in" placeholder="Keterangan (opsional)" value="'+esc(l.remarks)+'" oninput="S.lost['+ix+'].remarks=this.value;changed()">'
      +'<button class="icon-btn" title="Hapus" onclick="S.lost.splice('+ix+',1);changed();render()">'+IC.del+'</button></div>'
      +'</div>';
  });
  h+='<button class="add" style="height:48px;margin-top:'+(S.lost.length?'14':'0')+'px" onclick="S.lost.push(newLt());changed();render()">'+IC.plus+' Tambah lost time</button>';
  var qk=quickLt();
  if(qk.length)h+='<div class="qchips"><span class="qh">Sering dipakai</span>'+qk.map(function(i){return '<button type="button" onclick="addLt('+i+')">+ '+esc(M.lostTypes[i])+'</button>';}).join('')+'</div>';
  h+='</div>';
  $('app').innerHTML=h;
  updateBar();
  checkExisting();
  loadHist();
}
function pickBtn(val,ph,onclick,disabled){
  return '<button type="button" class="pick" '+(disabled?'disabled ':'')+'onclick="'+onclick+'"><span'+(val?'':' class="ph"')+'>'+esc(val||ph)+'</span>'+IC.dn+'</button>';
}
function itemSummary(it){
  var mc=isMc(it),q=n(it.normalQty)+n(it.otQty), m=mc?n(it.mcMin)+n(it.mcOtMin):n(it.normalMin)+n(it.otMin), bits=[];
  if(it.category)bits.push(it.category);
  if(mc)bits.push(it.mc);
  if(q)bits.push(fmt(q)+' pcs');
  if(m)bits.push(fmt(m)+(mc?' mnt MC':' mnt'));
  return bits.join(' • ')||'Belum diisi';
}
function itemHtml(it,ix){
  var c=cat(it.category), p=partOf(c,it.part), types=p?p.types:[];
  var ngTot=it.ng.reduce(function(a,b){return a+n(b);},0);
  var h='<div class="card item'+(it.open?'':' closed')+'" id="it'+it.id+'">';
  h+='<div class="item-h" onclick="toggleItem('+ix+')"><div class="badge">'+(ix+1)+'</div>'
    +'<div class="ttl"><b>'+esc(it.part||'Part baru')+(it.type&&it.type!=='-'?' <span style="color:var(--muted);font-weight:600">'+esc(it.type)+'</span>':'')+'</b><small>'+esc(itemSummary(it))+'</small></div>'
    +'<button class="icon-btn" title="Duplikat (kategori sama)" onclick="event.stopPropagation();dupItem('+ix+')">'+IC.copy+'</button>'
    +(S.items.length>1?'<button class="icon-btn" title="Hapus" onclick="event.stopPropagation();delItem('+ix+')">'+IC.del+'</button>':'')
    +'<span class="icon-btn">'+IC.chev+'</span></div>';
  h+='<div class="item-b">';
  h+='<div class="f" data-k="category" style="margin-top:12px"><span class="lb">Kategori <span class="req">*</span></span>';
  if(M.categories.length<=12){
    h+='<div class="cchips">'+M.categories.map(function(x,ci){return '<button type="button" class="'+(x.name===it.category?'on':'')+'" onclick="setCat('+ix+','+ci+')">'+esc(x.name)+'</button>';}).join('')+'</div>';
  } else h+=pickBtn(it.category,'Pilih kategori','pickCat('+ix+')');
  h+='</div>';
  h+='<div class="grid'+(p&&types.length?' g2':'')+'" style="margin-top:12px">';
  h+='<div class="f" data-k="part"><span class="lb">Part name <span class="req">*</span></span>'+pickBtn(it.part,c?'Pilih part':'Pilih kategori dulu','pickPart('+ix+')',!c)+'</div>';
  if(p&&types.length){
    h+='<div class="f" data-k="type"><span class="lb">Type <span class="req">*</span></span><div class="seg">';
    types.forEach(function(t){h+='<button type="button" class="'+(it.type===t?'on':'')+'" onclick="setF('+ix+',\'type\',\''+esc(t)+'\',true)">'+esc(t)+'</button>';});
    h+='</div></div>';
  }
  h+='</div>';
  if(c&&c.machines.length)h+='<div class="f" data-k="mc" style="margin-top:12px"><span class="lb">MC No <span class="req">*</span>'+(it.part?' <small style="font-weight:500;color:var(--muted)">mesin untuk part ini di depan</small>':'')+'</span>'+mcChips(ix)+'</div>';
  h+='<div class="sub">Hasil kerja</div><div class="grid g2 pairs">';
  var mc=isMc(it);
  h+=pairHtml(ix,'Normal','normalQty',mc?'mcMin':'normalMin',it,mc);
  h+=pairHtml(ix,'Lembur (OT)','otQty',mc?'mcOtMin':'otMin',it,mc);
  h+='</div>';
  h+='<div class="grid g2" style="margin-top:12px">'
    +'<label class="f"><span class="lb">Lot</span><input class="in" value="'+esc(it.lot)+'" oninput="setF('+ix+',\'lot\',this.value)"></label>'
    +'<label class="f" data-k="oiban"><span class="lb">Oiban <small style="font-weight:500;color:var(--muted)">contoh 1-6, 8</small></span><input class="in" value="'+esc(it.oiban)+'" oninput="setF('+ix+',\'oiban\',this.value);var e=$(\'ob'+it.id+'\');if(e)e.innerHTML=oibanInfo(this.value)"><small class="ob-i" id="ob'+it.id+'">'+oibanInfo(it.oiban)+'</small></label></div>';
  var ngN=c?c.ng:[];
  h+='<button type="button" class="ng-t" onclick="S.items['+ix+'].ngOpen=!S.items['+ix+'].ngOpen;changed();render()"><span>Jumlah NG'+(c&&c.ngGroup?' <span style="color:var(--muted);font-weight:500">• '+esc(c.ngGroup)+'</span>':'')+'</span><span class="tot'+(ngTot?' has':'')+'" id="ngt'+it.id+'">'+(ngTot?fmt(ngTot)+' pcs':'Tidak ada')+'</span></button>';
  if(it.ngOpen){
    h+='<div class="ngs">';
    var shown=0;
    for(var k=0;k<10;k++){
      if(!ngN[k]&&!n(it.ng[k]))continue;shown++;
      h+='<div class="ngr'+(n(it.ng[k])?' has':'')+'" id="ngr'+it.id+'_'+k+'"><div class="nm">'+esc(ngN[k]||('NG'+(k+1)))+'</div><div class="stp">'
        +'<button type="button" aria-label="Kurangi" onclick="stepNg('+ix+','+k+',-1)">&minus;</button>'
        +'<input id="ngi'+it.id+'_'+k+'" inputmode="numeric" placeholder="0" value="'+esc(it.ng[k])+'" oninput="setNg('+ix+','+k+',this.value)">'
        +'<button type="button" class="pl" aria-label="Tambah" onclick="stepNg('+ix+','+k+',1)">+</button></div></div>';
    }
    if(!shown)h+='<div class="empty">Pilih kategori dulu untuk melihat jenis NG.</div>';
    h+='</div>';
    if(lainIdx(c)>=0)h+='<label class="f" data-k="ngNote" style="margin-top:10px"><span class="lb">NG Lain-lain itu apa? <small style="font-weight:500;color:var(--muted)">wajib bila NG Lain-lain diisi</small></span><input class="in" value="'+esc(it.ngNote||'')+'" placeholder="contoh: retak, salah ukuran" oninput="setF('+ix+',\'ngNote\',this.value)"></label>';
  }
  h+='</div></div>';
  return h;
}
function pairHtml(ix,title,q,m,it,mc){
  return '<div class="pair"><div class="ph">'+title+'</div><div class="grid g2">'
    +'<label class="f" data-k="'+q+'"><span class="lb">Hasil (pcs)</span><input class="in num" inputmode="numeric" value="'+esc(it[q])+'" oninput="setF('+ix+',\''+q+'\',this.value)"></label>'
    +'<label class="f" data-k="'+m+'"><span class="lb">'+(mc?'Menit MC jalan':'Menit kerja')+'</span><input class="in num" inputmode="decimal" value="'+esc(it[m])+'" oninput="setF('+ix+',\''+m+'\',this.value)"></label>'
    +'</div></div>';
}

/* ---------- actions ---------- */
function changed(recheck){
  if(S.op&&S.op.auto){autoOp();var a=$('opMin'),b=$('opOt');if(a&&document.activeElement!==a)a.value=S.op.min;if(b&&document.activeElement!==b)b.value=S.op.ot;}
  saveDraft();updateBar();if(recheck)checkExisting();
}
function setF(ix,k,v,rerender){
  S.items[ix][k]=v;changed();
  if(rerender){render();return;}
  var it=S.items[ix],el=$('it'+it.id);
  if(el){el.querySelector('.ttl small').textContent=itemSummary(it);var f=el.querySelector('[data-k="'+k+'"]');if(f)f.classList.remove('err');}
}
function setNg(ix,k,v){
  var it=S.items[ix];it.ng[k]=v;changed();
  var t=it.ng.reduce(function(a,b){return a+n(b);},0),el=$('ngt'+it.id);
  el.textContent=t?fmt(t)+' pcs':'Tidak ada';el.className='tot'+(t?' has':'');
  var r=$('ngr'+it.id+'_'+k);if(r)r.className='ngr'+(n(v)?' has':'');
}
function stepNg(ix,k,d){
  var it=S.items[ix],v=Math.max(0,n(it.ng[k])+d),el=$('ngi'+it.id+'_'+k);
  if(el)el.value=v?String(v):'';
  setNg(ix,k,v?String(v):'');
}
function stepLt(ix,d){
  var l=S.lost[ix],v=Math.max(0,n(l.minutes)+d),el=$('lti'+l.id);
  l.minutes=v?String(v):'';l.auto=false;if(el)el.value=l.minutes;changed();
}
// Pilihan cepat lost time: grup Lost Time dulu, lalu jenis lain yang belum ada di daftar.
function quickLt(){
  var g=M.lostGroups||{},used={},a=[],b=[];
  S.lost.forEach(function(l){used[l.type]=1;});
  M.lostTypes.forEach(function(t,i){if(used[t])return;(/^lost/i.test(g[t]||'')?a:b).push(i);});
  return a.concat(b).slice(0,6);
}
function addLt(i){
  var l=newLt();l.type=M.lostTypes[i];S.lost.push(l);changed();render();
  setTimeout(function(){var el=$('lti'+l.id);if(el){el.focus();el.scrollIntoView({behavior:'smooth',block:'center'});}},30);
}
function setCat(ix,ci){
  var it=S.items[ix],v=M.categories[ci].name;if(it.category!==v){it.category=v;it.part='';it.type='';it.mc='';}changed();render();
}
// MC No: mesin yang biasa menjalankan part ini tampil sebagai tombol, mesin lain lewat daftar.
function mcChips(ix){
  var it=S.items[ix],c=cat(it.category),info=c.mcInfo||{},key=it.part?normPT(it.part+(it.type&&it.type!=='-'?it.type:'')):'',list=[];
  if(key)c.machines.forEach(function(m){var f=info[m]||{};if(mcRuns(f.main,key))list.push([m,'utama','']);});
  if(key)c.machines.forEach(function(m){var f=info[m]||{};if(!mcRuns(f.main,key)&&mcRuns(f.alt,key))list.push([m,'ganti type','alt']);});
  list=list.slice(0,7);
  if(it.mc&&it.mc!=='-'&&!list.some(function(x){return x[0]===it.mc;}))list.unshift([it.mc,'','']);
  var h='<div class="mcg">';
  list.forEach(function(x){h+='<button type="button" class="'+(it.mc===x[0]?'on':'')+'" onclick="setF('+ix+',\'mc\',\''+esc(x[0])+'\',true)">'+esc(x[0])+(x[1]?'<small class="'+x[2]+'">'+x[1]+'</small>':'')+'</button>';});
  h+='<button type="button" class="'+(it.mc==='-'?'on':'')+'" onclick="setF('+ix+',\'mc\',\'-\',true)">-<small>tanpa MC</small></button>';
  h+='<button type="button" class="more" onclick="pickMc('+ix+')">'+(list.length?'Mesin lain…':'Pilih MC…')+'</button>';
  return h+'</div>';
}
function toggleItem(ix){S.items[ix].open=!S.items[ix].open;changed();render();}
function addItem(){
  var last=S.items[S.items.length-1];
  S.items.forEach(function(i){i.open=false;});
  S.items.push(newItem(last?last.category:''));changed();render();
  setTimeout(function(){var el=$('it'+S.items[S.items.length-1].id);el&&el.scrollIntoView({behavior:'smooth',block:'start'});},30);
}
function dupItem(ix){
  var src=S.items[ix],it=newItem(src.category);it.mc=src.mc;
  S.items.forEach(function(i){i.open=false;});
  S.items.splice(ix+1,0,it);changed();render();toast('Part baru dengan kategori '+(src.category||'sama')+' ditambahkan');
  setTimeout(function(){var el=$('it'+it.id);el&&el.scrollIntoView({behavior:'smooth',block:'start'});},30);
}
function delItem(ix){
  if(!confirm('Hapus part #'+(ix+1)+'?'))return;
  S.items.splice(ix,1);changed();render();
}
function updateBar(){
  var q=0,ng=0,m=0,o=0,lt=0,bs=$('btnSend');if(bs&&bs.firstChild)bs.firstChild.textContent=S.editId?'Simpan perubahan ':'Periksa & kirim ';
  S.items.forEach(function(i){q+=n(i.normalQty)+n(i.otQty);ng+=i.ng.reduce(function(a,b){return a+n(b);},0);});m=workMin();o=workOt();
  S.lost.forEach(function(l){lt+=n(l.minutes);});
  var rest=M.normalMin-m-lt,hasWork=S.items.some(function(i){return i.part||n(i.normalMin)||n(i.mcMin);})||S.lost.length;
  var np=S.items.filter(function(i){return i.part;}).length,overOt=o/60>M.otLimitHrs;
  $('sSum').textContent=np+' part · '+fmt(q)+' pcs · NG '+fmt(ng)+(o?' · OT '+fmt(o/60)+' jam':'');
  var st=$('sSt');
  if(!hasWork){st.textContent='Isi part atau lost time';st.className='';}
  else{st.textContent=(rest===0?fmt(m+lt)+' menit, siap dikirim':rest>0?'Kurang '+fmt(rest)+' menit dari '+M.normalMin:'Lebih '+fmt(-rest)+' menit dari '+M.normalMin)+(overOt?' · OT lewat batas':'');st.className=rest===0&&!overOt?'okc':'wc';}
  drawMeter(m,lt,o,hasWork);
  var g=$('ltGap');if(!g)return;
  if(!hasWork){g.innerHTML='';return;}
  if(rest>0)g.innerHTML='<div class="notice" style="margin:0 0 14px">'+IC.warn+'<div style="flex:1">Waktu tercatat '+fmt(m)+' menit kerja + '+fmt(lt)+' menit lost time dari '+M.normalMin+' menit. <b>Isi lost time untuk sisa '+fmt(rest)+' menit.</b><br><button class="btn ghost" style="height:36px;margin-top:8px;font-size:13px" onclick="fillGap('+rest+')">'+IC.plus+' Tambah lost time '+fmt(rest)+' menit</button></div></div>';
  else if(rest===0)g.innerHTML='<div class="notice ok" style="margin:0 0 14px"><div>Waktu kerja lengkap: '+M.normalMin+' menit tercatat.</div></div>';
  else g.innerHTML='';
}
// Meter waktu kerja: menit produksi + lost time dibanding waktu kerja normal (480).
function drawMeter(m,lt,o,hasWork){
  var el=$('meter');if(!el)return;
  var N=M.normalMin,tot=m+lt,rest=N-tot,sc=Math.max(N,tot)||1;
  var st=!hasWork?'<span class="st" style="color:var(--muted)">belum diisi</span>':rest===0?'<span class="st okc">pas</span>':'<span class="st wc">'+(rest>0?'kurang '+fmt(rest):'lebih '+fmt(-rest))+'</span>';
  el.innerHTML='<div class="mt-top"><span style="font-weight:600">Waktu kerja hari ini</span><span><b class="v'+(hasWork&&rest!==0?' wc':hasWork?' okc':'')+'">'+fmt(tot)+'</b> / '+N+' menit · '+st+'</span></div>'
    +'<div class="mt-bar"><i class="p" style="width:'+(m/sc*100)+'%"></i><i class="l" style="width:'+(lt/sc*100)+'%"></i></div>'
    +'<div class="mt-leg"><span>Produksi '+fmt(m)+'</span><span class="l">Lost time '+fmt(lt)+'</span>'+(o?'<span style="color:var(--ink2)">Lembur '+fmt(o)+' menit</span>':'')+'</div>';
}
function gapMinutes(){var m=workMin(),lt=0;S.lost.forEach(function(l){lt+=n(l.minutes);});return M.normalMin-m-lt;}
function fillGap(rest){
  var empty=S.lost.filter(function(l){return !n(l.minutes);})[0];
  if(empty)empty.minutes=String(rest);else{var l=newLt();l.minutes=String(rest);S.lost.push(l);}
  changed();render();
  setTimeout(function(){var el=$('ltSec');el&&el.scrollIntoView({behavior:'smooth',block:'start'});},30);
  toast('Pilih jenis lost time untuk '+fmt(rest)+' menit');
}
var existTimer=null,existCache={};
function existHtml(r,mb){
  var h='';
  if(r.prod||r.lt)h+='<div class="notice">'+IC.warn+'<div>'+esc(mb)+' sudah punya '+r.prod+' baris produksi dan '+r.lt+' baris lost time yang disetujui di tanggal ini. Kirim lagi hanya untuk tambahan, bukan ulangan.</div></div>';
  if(r.subs&&r.subs.length){
    h+='<div class="subs">';
    r.subs.forEach(function(x){
      var cls=x.status==='Disetujui'?'ok':(x.status==='Ditolak'?'no':'w');
      h+='<div class="subrow"><div class="grow"><b>Kiriman '+esc(x.sent.slice(11))+'</b> • '+x.parts+' part'
        +(x.status==='Ditolak'&&x.note?'<br><span style="color:var(--red-d)">Alasan: '+esc(x.note)+'</span>':'')
        +(x.leader&&x.status!=='Menunggu'?'<br><span style="color:var(--muted)">oleh '+esc(x.leader)+'</span>':'')
        +(x.status==='Ditolak'&&x.items&&(x.items.length||x.lostTimes.length)?'<br><button class="btn ghost sm-btn" onclick="pakaiUlang(\''+esc(x.id)+'\')">Perbaiki &amp; kirim ulang</button>':'')
        +'</div><span class="pill '+cls+'">'+esc(x.status)+'</span></div>';
    });
    h+='</div>';
  }
  return h;
}
function checkExisting(force){
  var box=$('existing');if(!box)return;
  if(!S.date||!S.member){box.innerHTML='';return;}
  var key=S.date+'|'+S.member;
  if(existCache[key]&&!force){if(dropAuto(existCache[key]))return;box.innerHTML=existHtml(existCache[key],S.member);return;}
  clearTimeout(existTimer);
  existTimer=setTimeout(function(){
    var d=S.date,mb=S.member;
    call('cekLaporan',[d,mb],function(r){
      existCache[d+'|'+mb]=r;
      if(d!==S.date||mb!==S.member||!$('existing'))return;
      if(dropAuto(r))return;
      $('existing').innerHTML=existHtml(r,mb);
    },function(){});
  },350);
}

// Bila hari itu member sudah kirim, lost time harian otomatis tidak diisi lagi.
function dropAuto(r){
  var sudah=r.lt>0||(r.subs||[]).some(function(x){return x.status!=='Ditolak';});
  if(!sudah||!S.lost.some(function(l){return l.auto;}))return false;
  S.lost=S.lost.filter(function(l){return !l.auto;});
  saveDraft();render();
  toast('5S, briefing, dan input laporan sudah ada di kiriman sebelumnya, jadi tidak diisi lagi');
  return true;
}
// Muat isi kiriman ke form. editId diisi bila kiriman Menunggu diedit (akan diganti saat simpan).
function muatKiriman(x,editId){
  if((S.items.some(function(i){return i.part;})||S.lost.some(function(l){return !l.auto;}))&&!confirm('Isian di form sekarang akan diganti dengan isi kiriman ini. Lanjutkan?'))return;
  S.items=(x.items||[]).map(function(it){var o=newItem(it.category);Object.keys(it).forEach(function(k){if(k!=='id')o[k]=it[k];});if(it.mcMin===undefined){o.mcMin=it.normalMin;o.mcOtMin=it.otMin;}o.ng=(it.ng||[]).concat(['','','','','','','','','','']).slice(0,10);o.open=false;o.ngOpen=false;return o;});
  S.op=x.op?{min:String(x.op.min||''),ot:String(x.op.ot||''),auto:false}:{min:'',ot:'',auto:true};
  if(!S.items.length)S.items=[newItem()];
  S.lost=(x.lostTimes||[]).map(function(l){var o=newLt();o.type=l.type;o.minutes=l.minutes;o.remarks=l.remarks||'';return o;});
  if(x.date)S.date=x.date;
  S.editId=editId||'';S.editSent=editId?x.sent:'';
  changed(true);render();window.scrollTo(0,0);
  toast(editId?'Kiriman dimuat. Ubah yang perlu lalu tekan Simpan perubahan.':'Isi kiriman yang ditolak sudah dimuat. Perbaiki yang salah lalu kirim lagi.');
}
// Isi form dari kiriman yang ditolak, supaya member cukup memperbaiki yang salah.
function pakaiUlang(id){
  var r=existCache[S.date+'|'+S.member],x=r&&(r.subs||[]).filter(function(z){return z.id===id;})[0];
  if(!x)x=(HIST.list||[]).filter(function(z){return z.id===id;})[0];
  if(x)muatKiriman(x,'');
}
function editKirimanSaya(id){var x=(HIST.list||[]).filter(function(z){return z.id===id;})[0];if(x)muatKiriman(x,id);}
function batalEdit(){if(!confirm('Batalkan edit? Isian di form akan dikosongkan.'))return;S=freshState(true);saveDraft();render();}

/* ---------- riwayat member ---------- */
var HIST={member:'',list:null,open:{},show:false};
function loadHist(force){
  if(!S.member){HIST={member:'',list:null,open:{},show:HIST.show};drawHist();return;}
  if(HIST.member===S.member&&HIST.list&&!force){drawHist();return;}
  var mb=S.member;HIST.member=mb;HIST.list=null;drawHist();
  call('riwayatMember',[mb],function(r){if(HIST.member!==mb)return;HIST.list=r;drawHist();},function(){if(HIST.member===mb){HIST.list=[];drawHist();}});
}
function histTotals(x){var q=0,mn=0,lt=0;(x.items||[]).forEach(function(it){q+=n(it.normalQty)+n(it.otQty);mn+=n(it.normalMin);});(x.lostTimes||[]).forEach(function(l){lt+=n(l.minutes);});return {q:q,mn:mn,lt:lt};}
function drawHist(){
  var box=$('hist');if(!box)return;
  if(!S.member){box.innerHTML='';return;}
  var L0=HIST.list,h='<button class="hist-t" onclick="HIST.show=!HIST.show;drawHist()"><span>Riwayat saya (7 hari)</span><span class="cnt">'+(L0?L0.length+' kiriman':'memuat…')+'</span>'+IC.chev+'</button>';
  if(HIST.show){
    if(!L0)h+='<div class="empty">Memuat riwayat…</div>';
    else if(!L0.length)h+='<div class="empty">Belum ada kiriman dalam 7 hari terakhir.</div>';
    else L0.forEach(function(x){
      var t=histTotals(x),cls=x.status==='Disetujui'?'ok':(x.status==='Ditolak'?'no':'w'),op=HIST.open[x.id];
      h+='<div class="subrow" style="flex-direction:column;gap:6px"><div style="display:flex;gap:10px;width:100%;align-items:flex-start;cursor:pointer" onclick="HIST.open[\''+esc(x.id)+'\']=!HIST.open[\''+esc(x.id)+'\'];drawHist()">'
        +'<div class="grow"><b>'+esc(fmtDate(x.date))+'</b> • '+(x.items||[]).length+' part • '+fmt(t.q)+' pcs<br><span style="color:var(--muted)">'+fmt(t.mn)+' mnt kerja + '+fmt(t.lt)+' mnt lost time • dikirim '+esc(String(x.sent).slice(11))+'</span>'
        +(x.status==='Ditolak'&&x.note?'<br><span style="color:var(--red-d)">Alasan: '+esc(x.note)+'</span>':'')+'</div>'
        +'<span class="pill '+cls+'">'+esc(x.status)+'</span></div>';
      if(op){
        h+='<div style="width:100%;font-size:12px;color:var(--ink2)">'+(x.items||[]).map(function(it){return '• '+esc(it.part)+' '+esc(it.type&&it.type!=='-'?it.type:'')+(it.mc&&it.mc!=='-'?' ('+esc(it.mc)+')':'')+': '+fmt(n(it.normalQty)+n(it.otQty))+' pcs, '+(it.mcMin!==undefined&&it.mc&&it.mc!=='-'&&n(it.mcMin)+n(it.mcOtMin)?'MC '+fmt(n(it.mcMin)+n(it.mcOtMin))+' mnt':fmt(n(it.normalMin)+n(it.otMin))+' mnt')+(it.oiban?', oiban '+esc(it.oiban):'');}).join('<br>')+(x.op&&(n(x.op.min)||n(x.op.ot))?'<br>• Jaga mesin: '+fmt(n(x.op.min))+' mnt'+(n(x.op.ot)?' + OT '+fmt(n(x.op.ot)):''):'')
          +((x.lostTimes||[]).length?'<br>'+x.lostTimes.map(function(l){return '• '+esc(l.type)+': '+fmt(n(l.minutes))+' mnt';}).join('<br>'):'')+'</div>';
      }
      if(x.status==='Menunggu')h+='<button class="btn ghost sm-btn" style="margin-top:0" onclick="editKirimanSaya(\''+esc(x.id)+'\')">Edit kiriman ini</button>';
      else if(x.status==='Ditolak')h+='<button class="btn ghost sm-btn" style="margin-top:0" onclick="pakaiUlang(\''+esc(x.id)+'\')">Perbaiki &amp; kirim ulang</button>';
      h+='</div>';
    });
  }
  box.innerHTML=h;
}

/* ---------- picker ---------- */
var pickState=null;
function openPick(title,options,current,onPick){
  pickState={options:options,current:current,onPick:onPick,hl:0};
  $('pickTitle').textContent=title;$('pickQ').value='';
  drawPick();$('pickOv').classList.add('open');
  setTimeout(function(){if(window.matchMedia('(min-width:640px)').matches)$('pickQ').focus();},50);
}
function drawPick(){
  var q=$('pickQ').value.trim().toLowerCase(),h='',nz=function(x){return x.replace(/\b0+(\d)/g,'$1');},list=pickState.options.filter(function(o){return q?!o.head&&nz((o.label+' '+(o.sub||'')).toLowerCase()).indexOf(nz(q))>=0:true;});
  pickState.filtered=list;
  if(!q&&list[0]&&list[0].head)pickState.hl=1;
  list.forEach(function(o,i){if(o.head){h+='<div class="opt-h">'+esc(o.head)+'</div>';return;}h+='<button class="opt'+(o.value===pickState.current?' sel':'')+(i===pickState.hl&&q?' hl':'')+'" onclick="choose('+i+')"><span>'+esc(o.label)+'</span>'+(o.sub?'<small>'+esc(o.sub)+'</small>':'')+'</button>';});
  $('pickList').innerHTML=h||'<div class="empty" style="padding:24px">Tidak ditemukan</div>';
}
function choose(i){var o=pickState.filtered[i];if(o&&o.head)return;closePick();if(o)pickState.onPick(o.value);}
function closePick(){$('pickOv').classList.remove('open');}
$('pickQ').addEventListener('input',function(){pickState.hl=0;drawPick();});
$('pickQ').addEventListener('keydown',function(e){
  if(e.key==='Enter'){e.preventDefault();choose(pickState.hl);}
  else if(e.key==='ArrowDown'){pickState.hl=Math.min(pickState.hl+1,pickState.filtered.length-1);drawPick();}
  else if(e.key==='ArrowUp'){pickState.hl=Math.max(pickState.hl-1,0);drawPick();}
  else if(e.key==='Escape')closePick();
});
function opts(arr){return arr.map(function(v){return {value:v,label:v};});}
function pickMember(){openPick('Nama member',opts(M.members),S.member,function(v){S.member=v;saveMember(v);if(!S.lost.length&&!S.items.some(function(i){return i.part;}))S.lost=defLost();changed(true);render();});}
function pickCat(ix){
  openPick('Kategori',M.categories.map(function(c){return {value:c.name,label:c.name,sub:c.process};}),S.items[ix].category,function(v){
    var it=S.items[ix];if(it.category!==v){it.category=v;it.part='';it.type='';it.mc='';}changed();render();});
}
function pickPart(ix){
  var c=cat(S.items[ix].category);if(!c)return;
  openPick('Part • '+c.name,c.parts.map(function(p){return {value:p.name,label:p.name,sub:p.types.join(' / ')};}),S.items[ix].part,function(v){
    var it=S.items[ix],p=partOf(c,v);it.part=v;it.type=p&&p.types.length===1?p.types[0]:(p&&p.types.indexOf(it.type)>=0?it.type:'');changed();render();});
}
function normPT(x){return String(x||'').toUpperCase().replace(/\*KD/g,'').replace(/[^A-Z0-9]/g,'');}
function mcRuns(list,key){return !!key&&String(list||'').split(/[,;\n]/).some(function(x){return normPT(x)===key;});}
function pickMc(ix){
  var it=S.items[ix],c=cat(it.category),info=c.mcInfo||{},key=it.part?normPT(it.part+(it.type&&it.type!=='-'?it.type:'')):'',pt=it.part+(it.type&&it.type!=='-'?' '+it.type:'');
  var fit=[],alt=[],other=[];
  c.machines.forEach(function(m){
    var f=info[m]||{},sub=[f.main,f.line].filter(Boolean).join(' • ');
    if(mcRuns(f.main,key))fit.push({value:m,label:m,sub:sub+(f.alt?' • bisa ganti '+f.alt:'')});
    else if(mcRuns(f.alt,key))alt.push({value:m,label:m,sub:'Ganti type dari '+(f.main||'-')+(f.line?' • '+f.line:'')});
    else other.push({value:m,label:m,sub:sub+(f.alt?' • bisa ganti '+f.alt:'')});
  });
  var o=[];
  if(fit.length||alt.length){
    if(fit.length)o.push({head:'Mesin untuk '+pt}),o=o.concat(fit);
    if(alt.length)o.push({head:'Bisa dipakai '+pt+' (ganti type)'}),o=o.concat(alt);
    o.push({head:'Mesin lain'});
  }
  o=o.concat(other).concat([{value:'-',label:'-',sub:'Tidak pakai mesin'}]);
  openPick('MC No • '+c.name,o,it.mc,function(v){S.items[ix].mc=v;changed();render();});
}
function pickLt(ix){
  var g=M.lostGroups||{},order=[],by={},o=[];
  M.lostTypes.forEach(function(t){var k=g[t]||'';if(!by[k]){by[k]=[];order.push(k);}by[k].push({value:t,label:t});});
  order.forEach(function(k){if(k&&order.length>1)o.push({head:k});o=o.concat(by[k]);});
  openPick('Lost time / Another job',o,S.lost[ix].type,function(v){S.lost[ix].type=v;S.lost[ix].auto=false;changed();render();});
}

/* ---------- validation & send ---------- */
function validate(){
  var errs=[],first=null;
  function mark(sel,key,msg,openIx){
    errs.push(msg);
    if(openIx!=null&&!S.items[openIx].open){S.items[openIx].open=true;}
    first=first||{sel:sel,key:key};
  }
  if(!S.date)mark(null,'date','Tanggal belum diisi');
  if(!S.member)mark(null,'member','Nama member belum dipilih');
  var filledItems=S.items.filter(function(it){return it.category||it.part||it.normalQty||it.otQty||it.normalMin||it.otMin||it.mcMin||it.mcOtMin;});
  if(!filledItems.length&&!S.lost.length)errs.push('Isi minimal satu part atau lost time');
  S.items.forEach(function(it,ix){
    if(filledItems.indexOf(it)<0)return;
    var c=cat(it.category),p=partOf(c,it.part),L='Part #'+(ix+1)+': ';
    if(!it.category)mark(ix,'category',L+'kategori belum dipilih',ix);
    else if(!it.part)mark(ix,'part',L+'part belum dipilih',ix);
    else if(p&&p.types.length&&!it.type)mark(ix,'type',L+'type belum dipilih',ix);
    if(c&&c.machines.length&&it.part&&!it.mc)mark(ix,'mc',L+'MC No belum dipilih (pilih - bila tidak pakai mesin)',ix);
    if(!n(it.normalQty)&&!n(it.otQty))mark(ix,'normalQty',L+'qty normal atau OT belum diisi',ix);
    if(isMc(it)){
      if(n(it.normalQty)&&!n(it.mcMin))mark(ix,'mcMin',L+'menit MC jalan (normal) belum diisi',ix);
      if(n(it.otQty)&&!n(it.mcOtMin))mark(ix,'mcOtMin',L+'menit MC jalan (OT) belum diisi',ix);
    } else {
      if(n(it.normalQty)&&!n(it.normalMin))mark(ix,'normalMin',L+'menit normal belum diisi',ix);
      if(n(it.otQty)&&!n(it.otMin))mark(ix,'otMin',L+'menit OT belum diisi',ix);
    }
    var ob=uraiOiban(it.oiban);if(ob.err)mark(ix,'oiban',L+ob.err,ix);
    var li=lainIdx(c);if(li>=0&&n(it.ng[li])&&!String(it.ngNote||'').trim()){it.ngOpen=true;mark(ix,'ngNote',L+'NG Lain-lain diisi, tulis catatan jenis NG-nya',ix);}
  });
  var mcF=filledItems.filter(isMc);
  if(mcF.length){
    if(mcF.some(function(i){return n(i.normalQty);})&&!n(S.op.min))mark(null,'opMin','Waktu kerja operator di mesin (normal) belum diisi');
    if(mcF.some(function(i){return n(i.otQty);})&&!n(S.op.ot))mark(null,'opOt','Waktu kerja operator di mesin (OT) belum diisi');
  }
  S.lost.forEach(function(l,ix){
    if(!l.type)errs.push('Lost time #'+(ix+1)+': jenis belum dipilih');
    if(!n(l.minutes))errs.push('Lost time #'+(ix+1)+': menit belum diisi');
  });
  var rest=gapMinutes();
  if(!errs.length&&rest>0){
    if(!S.lost.length)S.lost.push(newLt());
    render();
    var sec=$('ltSec');sec&&sec.scrollIntoView({behavior:'smooth',block:'start'});
    toast('Waktu kerja kurang '+fmt(rest)+' menit dari '+M.normalMin+'. Isi lost time untuk sisanya.');
    return null;
  }
  if(errs.length){
    render();
    if(first){
      var root=first.sel==null?document:$('it'+S.items[first.sel].id);
      var el=root&&root.querySelector('[data-k="'+first.key+'"]');
      if(el){el.classList.add('err');el.scrollIntoView({behavior:'smooth',block:'center'});}
    }
    toast(errs[0]+(errs.length>1?' (+'+(errs.length-1)+' lainnya)':''));
    return null;
  }
  return filledItems;
}
function ngText(it){
  var c=cat(it.category),nm=c?c.ng:[],li=lainIdx(c),bits=[],tot=0;
  it.ng.forEach(function(v,k){if(!n(v))return;tot+=n(v);bits.push((nm[k]||('NG'+(k+1)))+' '+fmt(n(v))+(k===li&&it.ngNote?' ('+it.ngNote+')':''));});
  return tot?'NG '+fmt(tot)+': '+bits.join(', '):'';
}
function openReview(){
  var items=validate();if(!items)return;
  var q=0,m=workMin(),o=workOt(),ng=0,lt=0,rows='';
  items.forEach(function(it){
    var mc=isMc(it),iq=n(it.normalQty)+n(it.otQty),im=mc?n(it.mcMin)+n(it.mcOtMin):n(it.normalMin)+n(it.otMin),ing=it.ng.reduce(function(a,b){return a+n(b);},0),ob=uraiOiban(it.oiban).list.length,nt=ngText(it);
    q+=iq;ng+=ing;
    var info=[it.category,it.mc&&it.mc!=='-'?it.mc:'',fmt(im)+(mc?' menit MC':' menit'),it.lot?'Lot '+it.lot:'',it.oiban?'Oiban '+it.oiban+(ob>1?' ('+ob+')':''):''].filter(Boolean).join(' · ');
    rows+='<div class="prow"><div class="tp"><b>'+esc(it.part)+' '+esc(it.type&&it.type!=='-'?it.type:'')+'</b><b>'+fmt(iq)+' pcs</b></div><div class="in2">'+esc(info)+'</div>'+(nt?'<div class="ngl">'+esc(nt)+'</div>':'')+'</div>';
  });
  if(mcItems().length)rows+='<div class="prow lost">Waktu operator di mesin: <b>'+fmt(opMin('min'))+' mnt</b>'+(opMin('ot')?' + OT <b>'+fmt(opMin('ot'))+' mnt</b>':'')+' (dibagi ke '+mcItems().length+' MC sesuai menit MC jalan)</div>';
  S.lost.forEach(function(l){lt+=n(l.minutes);});
  if(S.lost.length)rows+='<div class="prow lost">Lost time: '+S.lost.map(function(l){return esc(l.type)+' '+fmt(n(l.minutes))+(l.remarks?' ('+esc(l.remarks)+')':'');}).join(' · ')+'</div>';
  var tot=m+lt;
  var h='<div class="meta"><span><b>'+esc(S.member)+'</b></span><span>'+esc(new Date(S.date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</span></div>';
  h+='<div class="tiles"><div class="tile"><small>Hasil</small><b>'+fmt(q)+'</b></div><div class="tile"><small>NG</small><b>'+fmt(ng)+'</b></div><div class="tile '+(tot===M.normalMin?'ok':'w')+'"><small>Menit</small><b>'+fmt(tot)+'</b></div></div>';
  if(rows)h+='<div class="plist">'+rows+'</div>';
  var w=[];
  if(tot>M.normalMin)w.push('Menit normal + lost time ('+fmt(tot)+') melebihi waktu kerja normal '+M.normalMin+' menit.');
  if(o/60>M.otLimitHrs)w.push('Jam OT ('+fmt(o/60)+') melebihi batas '+M.otLimitHrs+' jam per hari.');
  if(w.length)h+='<div class="warns">'+w.map(function(x){return '<div class="notice">'+IC.warn+'<div>'+esc(x)+' Tetap bisa dikirim bila memang benar.</div></div>';}).join('')+'</div>';
  $('rvBody').innerHTML=h;$('btnConfirm').textContent=S.editId?'Simpan perubahan':'Kirim laporan';$('revOv').classList.add('open');
}
function closeReview(){$('revOv').classList.remove('open');}
function send(){
  var items=validate();if(!items){closeReview();return;}
  var b=$('btnConfirm');b.disabled=true;b.innerHTML='<span class="spin"></span> Mengirim…';
  var payload={date:S.date,member:S.member,
    items:items.map(function(it){var o={category:it.category,part:it.part,type:it.type,mc:it.mc,normalQty:it.normalQty,normalMin:it.normalMin,otQty:it.otQty,otMin:it.otMin,lot:it.lot,oiban:it.oiban,ng:it.ng};if(String(it.ngNote||'').trim()&&lainIdx(cat(it.category))>=0&&n(it.ng[lainIdx(cat(it.category))]))o.ngNote=String(it.ngNote).trim();if(isMc(it)){o.mcMin=it.mcMin;o.mcOtMin=it.mcOtMin;}return o;}),
    lostTimes:S.lost.map(function(l){return {type:l.type,minutes:l.minutes,remarks:l.remarks};}),replaceId:S.editId||''};
  if(items.some(isMc))payload.op={min:S.op.min,ot:S.op.ot};
  call('submitReport',[payload],function(r){
    b.disabled=false;b.textContent='Kirim laporan';closeReview();clearDraft();HIST.member='';
    $('doneMsg').textContent=r.replaced?'Perubahan kiriman '+S.member+' sudah disimpan dan tetap menunggu validasi leader.':r.prod+' part dan '+r.lt+' lost time untuk '+S.member+' sudah terkirim dan menunggu validasi leader. Data masuk ke Dashboard setelah disetujui.';
    S.editId='';HIST.list=null;existCache={};
    $('app').style.display='none';$('bar').style.display='none';$('done').style.display='block';window.scrollTo(0,0);
  },function(msg){b.disabled=false;b.textContent='Kirim laporan';toast('Gagal mengirim: '+msg);});
}
function newReport(otherMember){
  S=freshState(!otherMember);saveDraft();
  existCache={};$('done').style.display='none';$('app').style.display='block';$('bar').style.display='block';render();window.scrollTo(0,0);
}

/* ---------- init ---------- */
var BASE_URL='';
function withMaster(ok,fail){
  if(window.BOOT&&BOOT.m){var m=BOOT.m;BOOT.m=null;ok(m);return;}
  call('getMasterData',[],ok,fail);
}
function startMember(){
  withMaster(function(m){
    M=m;
    var d=loadDraft();
    S=d||freshState(false);
    if(d&&(d.items.some(function(i){return i.part;})||d.lost.length))setTimeout(function(){toast('Isian terakhir yang belum terkirim dipulihkan');},300);
    $('bar').style.display='block';render();
  },function(msg){$('app').innerHTML='<div class="loading">Gagal memuat data: '+esc(msg)+'</div>';});
}
function route(page,base){
  BASE_URL=base||'';
  var ml=$('modeLink');
  if(BASE_URL){ml.style.display='inline-block';}
  if(page==='leader'){
    ml.textContent='Halaman input';ml.href=BASE_URL;
    $('hTitle').textContent='Validasi laporan';$('hSub').textContent='Quality Assurance • Persetujuan laporan member';
    startLeader();
  } else {
    ml.textContent='Leader';ml.href=BASE_URL+'?page=leader';
    startMember();
  }
}
if(window.BOOT&&BOOT.url){
  setTimeout(function(){route(BOOT.page,BOOT.url);},0); // tunggu semua fungsi & variabel leader terdefinisi
} else if(window.google&&google.script&&google.script.url){
  google.script.url.getLocation(function(loc){
    var page=(loc.parameter&&loc.parameter.page)||'';
    call('getScriptUrl',[],function(u){route(page,u);},function(){route(page,'');});
  });
} else {
  route(new URLSearchParams(location.search).get('page')||'', location.pathname);
}

/* ---------- leader ---------- */
var L={name:'',pin:'',tab:'Menunggu',date:'',data:null,sel:{},open:{}};
var LKEY='qa-leader-name';
function startLeader(){
  $('bar').style.display='none';
  withMaster(function(m){M=m;renderLogin();},function(msg){$('app').innerHTML='<div class="loading">Gagal memuat data: '+esc(msg)+'</div>';});
}
function renderLogin(err){
  var saved='';try{saved=localStorage.getItem(LKEY)||'';}catch(e){}
  if(!L.name&&M.leaders.indexOf(saved)>=0)L.name=saved;
  var balls='';for(var i=0;i<12;i++){var a=i/12*Math.PI*2;balls+='<circle cx="'+(100+Math.cos(a)*62).toFixed(1)+'" cy="'+(100+Math.sin(a)*62).toFixed(1)+'" r="13" fill="#E2E8F0" stroke="#64748B" stroke-opacity=".5"/>';}
  var h='<div class="lg2"><div class="lg2-l"><div class="k">PT Takai Seiki Indonesia</div><div><h2>Validasi Laporan Produksi</h2><p>Periksa dan setujui laporan harian member sebelum masuk ke Dashboard.</p></div>'
    +'<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="96" fill="#CBD5E1"/><circle cx="100" cy="100" r="78" fill="#3F0A0C"/>'+balls+'<circle cx="100" cy="100" r="46" fill="#CBD5E1"/><circle cx="100" cy="100" r="30" fill="#3F0A0C"/></svg></div>'
    +'<div class="lg2-r"><h3>Selamat Datang 👋</h3><p class="s">Masuk sebagai leader untuk memvalidasi laporan</p>';
  if(!M.leaders.length)h+='<div class="notice">'+IC.warn+'<div>Belum ada leader. Isi nama dan PIN di tab <b>Leader</b> (menu Master Data).</div></div>';
  h+='<div class="grid"><div class="f" data-k="lname"><span class="lb">Nama leader</span>'+pickBtn(L.name,'Pilih nama','pickLeader()')+'</div>'
    +'<label class="f"><span class="lb">PIN</span><span class="pinw"><input class="in num" id="lpin" type="password" inputmode="numeric" autocomplete="off" onkeydown="if(event.key===\'Enter\')doLogin()"><button type="button" onclick="var p=$(\'lpin\');p.type=p.type===\'password\'?\'text\':\'password\';this.textContent=p.type===\'password\'?\'Lihat\':\'Sembunyikan\'">Lihat</button></span></label>'
    +(err?'<div class="notice" style="margin-top:0">'+IC.warn+'<div>'+esc(err)+'</div></div>':'')
    +'<button class="btn" id="btnLogin" style="width:100%;justify-content:center" onclick="doLogin()">Masuk <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>'
    +'<div class="ft">© '+new Date().getFullYear()+' PT Takai Seiki Indonesia · Production Monitoring System</div></div></div>';
  $('app').innerHTML=h;
}
function pickLeader(){openPick('Nama leader',opts(M.leaders),L.name,function(v){L.name=v;renderLogin();});}
function doLogin(){
  var pin=$('lpin').value;
  if(!L.name){toast('Pilih nama leader');return;}
  if(!pin){toast('Masukkan PIN');return;}
  var b=$('btnLogin');b.disabled=true;b.innerHTML='<span class="spin"></span> Memeriksa…';
  call('leaderLogin',[L.name,pin],function(){
    L.pin=pin;try{localStorage.setItem(LKEY,L.name);}catch(e){}
    loadQueue();
  },function(msg){renderLogin(msg);});
}
function loadQueue(keepSel){
  if(!keepSel)L.sel={};
  $('app').innerHTML=leaderShell('<div class="loading"><div class="spin"></div>Memuat kiriman…</div>');
  call('getAntrian',[L.name,L.pin,L.tab,L.date],function(r){L.data=r;renderQueue();},function(msg){toast(msg);renderLogin(msg);});
}
function leaderShell(body){
  var c=L.data?L.data.counts:{};
  var tab=function(k,label){return '<button class="'+(L.tab===k?'on':'')+'" onclick="L.tab=\''+k+'\';loadQueue()">'+label+(c[k]!=null?' '+c[k]:'')+'</button>';};
  return '<div class="lband"><div class="lwho"><span><b>'+esc(L.name)+'</b> · Leader</span>'
    +'<input class="in" type="date" value="'+esc(L.date)+'" onchange="L.date=this.value;loadQueue()">'
    +(L.date?'<button class="lnk" onclick="L.date=\'\';loadQueue()">Semua tanggal</button>':'')
    +'<span style="margin-left:auto;display:flex;gap:14px"><a href="/hari-ini" style="text-decoration:none">Hari Ini &amp; Laporan</a><button class="lnk" onclick="L.pin=\'\';L.data=null;renderLogin()">Keluar</button></span></div>'
    +'<div class="ltabs">'+tab('Menunggu','Menunggu')+tab('Disetujui','Disetujui')+tab('Ditolak','Ditolak')+'</div></div>'
    +body;
}
function subTotals(s){
  var n=function(v){var x=parseFloat(v);return isNaN(x)?0:x;},q=0,mn=0,ot=0,ng=0,lt=0;
  s.items.forEach(function(it){q+=n(it.normalQty)+n(it.otQty);mn+=n(it.normalMin);ot+=n(it.otMin);(it.ng||[]).forEach(function(v){ng+=n(v);});});
  s.lostTimes.forEach(function(l){lt+=n(l.minutes);});
  return {q:q,mn:mn,ot:ot,ng:ng,lt:lt};
}
function fmtDate(d){try{return new Date(d+'T00:00:00').toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});}catch(e){return d;}}
function inisial(nm){var w=String(nm||'').trim().split(/\s+/);return ((w[0]||'').charAt(0)+(w[1]||'').charAt(0)).toUpperCase()||'?';}
function renderQueue(){
  var list=L.data.list,h='',pend=L.tab==='Menunggu';
  if(!list.length){
    h='<div class="card" style="margin-top:14px"><div class="empty" style="padding:28px 0">'+(pend?'Tidak ada kiriman yang menunggu validasi.':'Belum ada kiriman '+L.tab.toLowerCase()+'.')+'</div></div>';
  } else {
    if(pend){
      var nok=list.filter(function(s){return !perluCek(s);}).length;
      h+='<div class="lrow"><button class="btn green" '+(nok?'':'disabled')+' onclick="approveAllOk()">Setujui semua yang lengkap ('+nok+')</button></div>';
    } else h+='<div style="height:14px"></div>';
    list.forEach(function(s){
      var t=subTotals(s),w=[],id=esc(s.id),tot=t.mn+t.lt;
      if(t.mn+t.lt>M.normalMin)w.push('Menit normal + lost time '+fmt(t.mn+t.lt)+' lebih dari '+M.normalMin);
      if(t.ot/60>M.otLimitHrs)w.push('OT '+fmt(t.ot/60)+' jam lewat batas '+M.otLimitHrs+' jam');
      var info=[];if(Math.abs(tot-M.normalMin)>=1&&tot<M.normalMin)info.push('Total menit '+fmt(tot)+', kurang '+fmt(M.normalMin-tot)+' dari '+M.normalMin+' (cek apakah ada kiriman lain hari ini)');
      var cats={};s.items.forEach(function(it){cats[it.category]=1;});
      var bdg=pend?(w.length?'<span class="bdg w">Perlu dicek</span>':'<span class="bdg">Lengkap</span>'):(s.status==='Disetujui'?'<span class="bdg">Disetujui</span>':'<span class="bdg no">Ditolak</span>');
      var sub=(L.date?'':fmtDate(s.date)+' · ')+'Kirim '+esc(s.sent.slice(11,16).replace(':','.'))+(Object.keys(cats).length?' · '+esc(Object.keys(cats).join(', ')):'')+' · '+(s.items.length?s.items.length+' part':'hanya lost time');
      var pct=t.q+t.ng>0&&t.ng?(t.ng/(t.q+t.ng)*100).toLocaleString('id-ID',{maximumFractionDigits:2})+'%':'';
      h+='<div class="lc'+(L.open[s.id]?' open':'')+'" id="sc'+id+'"><div class="lc-h" onclick="toggleSc(\''+id+'\')"><span class="av">'+esc(inisial(s.member))+'</span><div class="grow"><b>'+esc(s.member)+'</b><small>'+sub+'</small></div>'+bdg+'</div>';
      h+='<div class="st3"><div><small>Hasil</small><b>'+fmt(t.q)+'</b></div><div><small>NG</small><b>'+fmt(t.ng)+(pct?' <em>'+pct+'</em>':'')+'</b></div><div><small>Menit</small><b'+(Math.abs(tot-M.normalMin)>=1?' class="wc"':'')+'>'+fmt(tot)+(t.ot?' <em>+OT '+fmt(t.ot)+'</em>':'')+'</b></div></div>';
      w.concat(info).forEach(function(x){h+='<div class="lwarn">'+esc(x)+'</div>';});
      if(s.edited)h+='<div class="ldec">Diedit '+esc(s.edited)+'</div>';
      if(!pend)h+='<div class="ldec">'+esc(s.status)+' oleh '+esc(s.leader)+' · '+esc(String(s.decided||'').slice(5,16).replace('-','/'))+(s.note?' · '+esc(s.note):'')+'</div>';
      h+='<div class="lc-d">';
      s.items.forEach(function(it){
        var mc=it.mcMin!==undefined&&it.mc&&it.mc!=='-',ob=uraiOiban(it.oiban).list.length,iq=n(it.normalQty)+n(it.otQty),nt=ngText(it);
        var bits=[it.category,it.mc&&it.mc!=='-'?it.mc:'',mc?'MC jalan '+fmt(n(it.mcMin))+(n(it.mcOtMin)?' + OT '+fmt(n(it.mcOtMin)):'')+' mnt':'',fmt(n(it.normalMin))+(n(it.otMin)?' + OT '+fmt(n(it.otMin)):'')+' mnt kerja',it.lot?'Lot '+it.lot:'',it.oiban?'Oiban '+it.oiban+(ob>1?' ('+ob+')':''):''].filter(Boolean).join(' · ');
        h+='<div class="prow"><div class="tp"><b>'+esc(it.part)+' '+esc(it.type&&it.type!=='-'?it.type:'')+'</b><span><b>'+fmt(iq)+'</b> pcs'+(n(it.otQty)?' <small style="color:var(--muted)">(OT '+fmt(n(it.otQty))+')</small>':'')+'</span></div><div class="in2">'+esc(bits)+'</div>'+(nt?'<div class="ngl">'+esc(nt)+'</div>':'')+'</div>';
      });
      if(s.op&&(n(s.op.min)||n(s.op.ot)))h+='<div class="prow lost">Waktu operator di mesin: <b>'+fmt(n(s.op.min))+' mnt</b>'+(n(s.op.ot)?' + OT <b>'+fmt(n(s.op.ot))+'</b>':'')+' (menit kerja per part = bagian per MC)</div>';
      if(s.lostTimes.length)h+='<div class="prow lost">Lost time '+fmt(t.lt)+' menit: '+s.lostTimes.map(function(l){return esc(l.type)+' '+fmt(n(l.minutes))+(l.remarks?' ('+esc(l.remarks)+')':'');}).join(' · ')+'</div>';
      if(pend)h+='<div class="lacts" style="padding-bottom:0"><button class="btn line" onclick="editOne(\''+id+'\')">Edit kiriman ini</button></div>';
      h+='</div>';
      if(pend)h+='<div class="lacts"><button class="btn main '+(w.length?'grey':'green')+'" onclick="decide([\''+id+'\'],\'ok\',\'\')">Setujui</button><button class="btn line" onclick="toggleSc(\''+id+'\')">'+(L.open[s.id]?'Tutup':'Detail')+'</button><button class="btn soft" onclick="rejectOne(\''+id+'\')">Tolak</button></div>';
      else h+='<div class="lacts" style="padding-top:0"><button class="btn line" onclick="toggleSc(\''+id+'\')">'+(L.open[s.id]?'Tutup detail':'Lihat detail')+'</button></div>';
      h+='</div>';
    });
  }
  h+='<div id="belum"></div>';
  $('app').innerHTML=leaderShell(h);
  loadBelum();
}
// Member yang belum kirim pada tanggal yang dipilih (atau hari ini).
var BELUM={};
function loadBelum(){
  var d=L.date||M.today,box=$('belum');if(!box)return;
  var draw=function(list){var b=$('belum');if(!b||!list)return;b.innerHTML=list.length?'<div class="missing"><h3>Belum kirim '+(d===M.today?'hari ini':esc(fmtDate(d)))+' <span>('+list.length+')</span></h3>'+list.map(function(m){return '<span class="ch">'+esc(m)+'</span>';}).join('')+'</div>':'';};
  if(BELUM[d]){draw(BELUM[d]);return;}
  call('belumKirim',[L.name,L.pin,d],function(r){BELUM[d]=r||[];setTimeout(function(){delete BELUM[d];},60000);draw(BELUM[d]);},function(){});
}
function approveAllOk(){L.sel={};L.data.list.forEach(function(s){if(!perluCek(s))L.sel[s.id]=true;});approveSel();}
function toggleSc(id){L.open[id]=!L.open[id];renderQueue();}
function perluCek(s){var t=subTotals(s);return t.mn+t.lt>M.normalMin||t.ot/60>M.otLimitHrs;}
function selAll(v){L.sel={};if(v)L.data.list.forEach(function(s){if(!perluCek(s))L.sel[s.id]=true;});renderQueue();}
function approveSel(){
  var ids=Object.keys(L.sel).filter(function(k){return L.sel[k];});
  if(!ids.length)return;
  if(!confirm('Setujui '+ids.length+' kiriman? Datanya akan masuk ke Dashboard.'))return;
  decide(ids,'ok','');
}
function rejectOne(id){
  var note=prompt('Alasan penolakan (akan dilihat member):');
  if(note===null)return;
  if(!note.trim()){toast('Alasan wajib diisi');return;}
  decide([id],'no',note.trim());
}
/* ---------- leader: edit kiriman ---------- */
var E=null;
function editOne(id){
  var s=L.data.list.filter(function(x){return x.id===id;})[0];if(!s)return;
  E={id:id,member:s.member,date:s.date,items:JSON.parse(JSON.stringify(s.items)),lost:JSON.parse(JSON.stringify(s.lostTimes)),op:s.op?{min:s.op.min,ot:s.op.ot}:null};
  E.items.forEach(function(it){it.ng=(it.ng||[]).concat(['','','','','','','','','','']).slice(0,10);});
  renderEdit();$('edOv').classList.add('open');
}
function closeEdit(){$('edOv').classList.remove('open');E=null;}
function edIn(label,val,path,num){
  return '<label class="f"><span class="lb">'+esc(label)+'</span><input class="in'+(num?' num':'')+'"'+(num?' inputmode="decimal"':'')+' value="'+esc(val)+'" oninput="'+path+'=this.value"></label>';
}
function edSel(label,list,val,path,rerender){
  var o=list.slice();if(val&&o.indexOf(val)<0)o.unshift(val);
  return '<label class="f"><span class="lb">'+esc(label)+'</span><select class="in" onchange="'+path+'=this.value'+(rerender?';renderEdit()':'')+'">'
    +(val?'':'<option value="">Pilih…</option>')
    +o.map(function(x){return '<option value="'+esc(x)+'"'+(x===val?' selected':'')+'>'+esc(x)+'</option>';}).join('')+'</select></label>';
}
function renderEdit(){
  var h='<div class="meta"><span><b>'+esc(E.member)+'</b></span><span>'+esc(fmtDate(E.date))+'</span></div>';
  E.items.forEach(function(it,ix){
    var c=cat(it.category),p=partOf(c,it.part),P='E.items['+ix+']';
    h+='<div class="ed-it"><div class="ed-h"><div class="grow"><b>'+esc(it.part)+'</b><small>'+esc(it.category)+'</small></div>'
      +'<button class="icon-btn" title="Hapus part" onclick="E.items.splice('+ix+',1);renderEdit()">'+IC.del+'</button></div><div class="ed-g">'
      +(c?edSel('Part',c.parts.map(function(x){return x.name;}),it.part,P+'.part',true):'')
      +(p&&p.types.length?edSel('Type',p.types,it.type,P+'.type'):'')
      +(c&&c.machines.length?edSel('MC No',['-'].concat(c.machines),it.mc,P+'.mc'):'')
      +edIn('Lot',it.lot,P+'.lot')
      +edIn('Qty normal',it.normalQty,P+'.normalQty',1)+(isMc(it)?edIn('Menit MC jalan normal',it.mcMin,P+'.mcMin',1):edIn('Menit normal',it.normalMin,P+'.normalMin',1))
      +edIn('Qty OT',it.otQty,P+'.otQty',1)+(isMc(it)?edIn('Menit MC jalan OT',it.mcOtMin,P+'.mcOtMin',1):edIn('Menit OT',it.otMin,P+'.otMin',1))
      +edIn('Oiban',it.oiban,P+'.oiban')+'</div><div class="ed-sec">NG (pcs)</div><div class="ed-g">';
    for(var k=0;k<10;k++)h+=edIn((c&&c.ng&&c.ng[k])||('NG'+(k+1)),it.ng[k],P+'.ng['+k+']',1);
    if(lainIdx(c)>=0)h+=edIn('Catatan NG Lain-lain',it.ngNote||'',P+'.ngNote');
    h+='</div></div>';
  });
  if(E.op)h+='<div class="ed-sec">Waktu operator di mesin (dibagi ke tiap MC)</div><div class="ed-it"><div class="ed-g">'+edIn('Normal (menit)',E.op.min,'E.op.min',1)+edIn('OT (menit)',E.op.ot,'E.op.ot',1)+'</div></div>';
  h+='<div class="ed-sec">Lost time / Another job</div>';
  E.lost.forEach(function(l,ix){
    var P='E.lost['+ix+']';
    h+='<div class="ed-it"><div class="ed-g">'+edSel('Jenis',M.lostTypes,l.type,P+'.type')+edIn('Menit',l.minutes,P+'.minutes',1)+'</div>'
      +'<div class="ed-h" style="margin:10px 0 0"><div class="grow">'+edIn('Keterangan',l.remarks||'',P+'.remarks')+'</div>'
      +'<button class="icon-btn" title="Hapus" onclick="E.lost.splice('+ix+',1);renderEdit()">'+IC.del+'</button></div></div>';
  });
  h+='<button class="add" style="height:44px" onclick="E.lost.push({type:\'\',minutes:\'\',remarks:\'\'});renderEdit()">'+IC.plus+' Tambah lost time</button>';
  $('edBody').innerHTML=h;
}
function saveEdit(andApprove){
  if(!E.items.length&&!E.lost.length){toast('Laporan tidak boleh kosong');return;}
  for(var i=0;i<E.lost.length;i++){if(!E.lost[i].type||!n(E.lost[i].minutes)){toast('Lost time #'+(i+1)+': jenis dan menit wajib diisi');return;}}
  var id=E.id,b1=$('btnEdSave'),b2=$('btnEdOk');b1.disabled=b2.disabled=true;
  var d={items:E.items,lostTimes:E.lost};if(E.op)d.op=E.op;
  call('editKiriman',[L.name,L.pin,id,d],function(){
    b1.disabled=b2.disabled=false;closeEdit();
    if(andApprove)decide([id],'ok','');else{toast('Perubahan disimpan');loadQueue(true);}
  },function(msg){b1.disabled=b2.disabled=false;toast('Gagal menyimpan: '+msg);});
}
function decide(ids,action,note){
  toast(action==='ok'?'Menyimpan persetujuan…':'Menyimpan penolakan…');
  call('putuskan',[L.name,L.pin,ids,action,note],function(r){
    var msg=(action==='ok'?r.ok+' kiriman disetujui dan masuk ke sheet':r.ok+' kiriman ditolak');
    if(r.skip)msg+=' ('+r.skip+' sudah diproses leader lain)';
    if(r.errors.length)msg='Gagal: '+r.errors[0];
    toast(msg);loadQueue();
  });
}
</script>
</body>
</html>
`;
