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
.ov.open{display:flex;animation:ovIn .18s ease-out}
@keyframes ovIn{from{background:rgba(16,18,24,0)}}
.sheet{background:#fff;width:100%;max-width:560px;max-height:86vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;animation:up .22s cubic-bezier(.2,.7,.2,1)}
@media(min-width:640px){.ov{align-items:center}.sheet{border-radius:20px;max-height:80vh;animation-name:pop}}
@keyframes pop{from{transform:scale(.96);opacity:0}to{transform:none;opacity:1}}
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
.toast{position:fixed;left:50%;bottom:96px;transform:translate(-50%,16px);background:var(--ink);color:#fff;padding:10px 16px;border-radius:12px;font-size:13px;z-index:60;opacity:0;transition:opacity .2s ease,transform .22s cubic-bezier(.2,.7,.2,1);pointer-events:none;max-width:90vw;box-shadow:0 10px 30px rgba(16,24,40,.25)}
.toast.show{opacity:1;transform:translate(-50%,0)}

/* ---- Tampilan v2.3 (marun TAKAI): isi dan alur sama ---- */
.band{background:var(--red);color:#fff;margin:0 -16px;padding:2px 16px 18px;box-shadow:0 0 0 100vmax var(--red);clip-path:inset(0 -100vmax)}
.idrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:10px}
.idc{display:block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:14px;padding:8px 12px;min-width:0;cursor:pointer;text-align:left;color:#fff}
.idc small{display:block;font-size:11px;font-weight:600;opacity:.8}
.idc input,.idc b{display:block;width:100%;background:none;border:0;color:#fff;font-weight:700;font-size:15px;padding:0;height:24px;outline:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.idc input::-webkit-calendar-picker-indicator{filter:invert(1);opacity:.8}
.idc.err{border-color:#FFD7D9;background:rgba(255,255,255,.26)}
.idc .ph{opacity:.75;font-weight:600}
.idc.me{cursor:default;display:flex;align-items:center;gap:10px}.idc.me:active{transform:none}
.idc.me .av{flex:none;width:32px;height:32px;border-radius:50%;background:#fff;color:var(--red);display:grid;place-items:center;font-weight:800;font-size:13px}
.idc.me .nm{min-width:0;flex:1}.idc.me .nm b{height:auto}
.who{display:flex;align-items:center;gap:8px;margin:0 0 10px;color:rgba(255,255,255,.85);font-size:12.5px;font-weight:600}.who b{color:#fff}
.who button,.idc.me button{margin-left:auto;flex:none;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:10px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer}
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
.lg2-l{position:relative;overflow:hidden;width:44%;background:linear-gradient(#fff,#f4f5f7);color:var(--ink);display:flex;flex-direction:column;min-height:380px;border-right:1px solid var(--line)}
.lg2-l:before{content:"";position:absolute;z-index:2;left:0;top:0;bottom:0;width:6px;background:var(--red)}
.lg2-t{position:relative;z-index:1;padding:32px 28px 0}
.lg2-l h2{margin:14px 0 0;font-size:24px;line-height:1.2}.lg2-l h2 em{font-style:normal;color:var(--red)}
.lg2-l .lg2-bar{display:block;width:48px;height:4px;border-radius:4px;background:var(--red);margin-top:10px}
.lg2-l p{margin:10px 0 0;font-size:13px;color:var(--muted);max-width:250px}
.lg2-l .k{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.lg2-img{position:relative;margin-top:auto}.lg2-img img{display:block;width:100%;height:auto}
.lg2-img:after{content:"";position:absolute;left:0;right:0;top:0;height:110px;background:linear-gradient(#f4f5f7,rgba(244,245,247,.75) 40%,rgba(244,245,247,0))}
.lg2-r{flex:1;padding:40px 36px}
.lg2-r h3{margin:0;font-size:22px}.lg2-r .s{margin:4px 0 22px;color:var(--muted);font-size:13px}
.lg2-r .pinw{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:12px;padding-right:10px;background:#fff}
.lg2-r .pinw .in{border:0;box-shadow:none}.lg2-r .pinw button{border:0;background:none;font-weight:700;font-size:12px;color:var(--ink2);cursor:pointer}
.lg2-r .ft{margin-top:26px;text-align:center;font-size:11px;color:var(--muted)}
@media(max-width:640px){.lg2{flex-direction:column;margin:0 -16px;border-radius:0;box-shadow:none}.lg2-l{width:auto;min-height:0;border-right:0;border-bottom:1px solid var(--line)}.lg2-t{padding:22px 20px 0}.lg2-img{margin-top:12px;height:150px}.lg2-img img{height:100%;object-fit:cover;object-position:50% 60%}.lg2-r{padding:26px 20px}}
#revOv .sheet-f{display:grid;grid-template-columns:1fr 2fr}#revOv .sheet-f .btn{justify-content:center}
/* motion: cepat, halus, tidak menghalangi input */
.btn,.seg button,.cchips button,.qchips button,.mcg button,.stp button,.ltabs button,.pick,.icon-btn,.add,.idc{transition:background-color .15s ease,border-color .15s ease,color .15s ease,box-shadow .2s ease,transform .15s ease}
.btn:active:not(:disabled),.seg button:active,.cchips button:active,.qchips button:active,.mcg button:active,.stp button:active,.ltabs button:active,.add:active,.idc:active{transform:scale(.97)}
.btn:focus-visible,.pick:focus-visible,.cchips button:focus-visible,.mcg button:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(155,27,31,.18)}
.btn.green:hover{box-shadow:0 8px 20px -6px rgba(22,101,52,.5)}
.stp input,.in{transition:border-color .15s ease,box-shadow .15s ease}
.stp input:focus{box-shadow:0 0 0 4px rgba(22,24,29,.06)}
.err .in,.err .pick,.idc.err{animation:errIn .25s ease}
@keyframes errIn{from{box-shadow:0 0 0 6px rgba(155,27,31,.25)}to{box-shadow:0 0 0 0 rgba(155,27,31,0)}}
.lg2,#done{animation:fadeUp .24s cubic-bezier(.2,.7,.2,1) both}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.lc{transition:box-shadow .2s ease}.lc:hover{box-shadow:0 6px 24px rgba(16,24,40,.08)}
.mt-bar i{transition:width .3s cubic-bezier(.2,.7,.2,1)}
.ngr{transition:border-color .15s ease,background-color .15s ease}
.btn .spin{animation-duration:.7s}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
/* ---- Tampilan v4 (form member, mengikuti mockup): header merah, panel putih, layar terpisah untuk edit part & lost time.
   Field, label, hitungan, dan alur kirim tetap sama ---- */
:root{--r:14px;--rs:12px;--line:#E4E6EB;--bg:#F4F5F7;--shadow:0 1px 2px rgba(16,24,40,.05),0 2px 8px rgba(16,24,40,.04);--blue:#2563EB;--blue-soft:#EEF4FF;--pink:#FDF0F0}
.wrap{padding:0 16px 150px}
.hero{background:var(--red)}
.hero-in{padding:14px 16px 10px;align-items:center}
.hero .logo{border-radius:10px;padding:6px 8px}
.hero img{height:30px}
.hero h1{font-size:18px}
.hero-r{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:none}
.hero-in .mode{margin-left:0;padding:5px 10px;font-size:12px;border-radius:9px}
.hlo{display:none;background:none;border:0;color:#fff;padding:2px;cursor:pointer;opacity:.9}
.hlo.on{display:block}
@media(max-width:480px){.hero img{height:26px}.hero h1{font-size:16px}.hero-in{padding:12px 16px 8px}}
/* kartu Tanggal & Nama member di pita merah */
.band{padding:6px 16px 30px}
.idrow{grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:10px}
.idc{display:flex;align-items:center;gap:10px;border-radius:var(--r);padding:10px 12px;min-height:62px;background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.22)}
.idc>svg{flex:none;opacity:.95}
.idc .tx{min-width:0;flex:1}
.idc small{font-size:11.5px;opacity:.85}
.idc input,.idc b{font-size:15.5px}
.idc input{min-width:0}
div.idc{cursor:default}div.idc:active{transform:none}
/* panel putih bergaris lengkung di atas pita merah */
.pane{position:relative;margin:-18px -16px 0;padding:14px 16px 0;background:var(--bg);border-radius:22px 22px 0 0}
.pane>.notice:first-child,.pane>#existing:first-child .notice{margin-top:0}
#existing .notice{background:var(--warn-soft);border:1px solid #F7DDBA;margin-top:0;margin-bottom:12px}
#existing .notice.ok{background:var(--ok-soft);border-color:#C9EBDB}
#existing:empty{display:none}
.subs{margin-top:0}
#hist{margin-bottom:12px}
.subrow{background:#fff;border-color:var(--line)}
/* meter 480 menit */
.meter{margin-top:0;border:1px solid var(--line);border-radius:var(--r);padding:14px;box-shadow:var(--shadow)}
.mt-top2{display:flex;align-items:flex-start;gap:12px}
.mt-ic{flex:none;width:40px;height:40px;border-radius:11px;background:#FFF4E5;color:#E58A1F;display:grid;place-items:center}
.mt-ic.ok{background:var(--ok-soft);color:var(--ok)}
.mt-l{flex:1;min-width:0}
.mt-l span{display:block;font-size:14px;font-weight:700}
.mt-l b{font-size:24px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.mt-l b em{font-style:normal;font-size:16px;font-weight:700;color:var(--ink)}
.mt-r{text-align:right;flex:none}
.mt-r small{display:block;font-size:12px;color:var(--muted)}.mt-r small b{color:var(--ink)}
.mt-r .st{display:block;margin-top:8px;font-size:14px;font-weight:800}
.mt-bar{height:10px;margin:12px 0 10px}
.mt-bar .l{background:#F2A7AA}
.mt-leg{gap:6px 14px;font-size:12px;color:var(--ink2)}
.mt-leg span::before{border-radius:3px}
.mt-leg span.s::before{background:#D5D9E0}
.mt-leg b{font-weight:700}
/* judul bagian */
.sec-h{margin:22px 2px 10px}
.sec-h h2{font-size:13px;letter-spacing:.06em;color:var(--ink);font-weight:800}
.sec-h .cnt{font-size:12.5px}
.card{border-radius:var(--r);box-shadow:var(--shadow)}
/* daftar part */
.pcard{background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);margin-bottom:10px;overflow:hidden}
.pcard.invalid{border-color:var(--red)}
.pc-h{display:flex;align-items:center;gap:12px;padding:12px 12px 10px 14px;cursor:pointer;min-height:64px}
.pc-h .badge{width:38px;height:38px;border-radius:10px;font-size:15px}
.pc-h .ttl{flex:1;min-width:0}
.pc-h .ttl b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc-h .ttl small{display:block;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.pc-h>svg{flex:none;color:var(--muted)}
.pc-a{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 12px 12px}
.pc-a button{height:42px;border-radius:11px;border:1px solid var(--line);background:#fff;font-weight:600;font-size:13.5px;color:var(--ink2);display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}
.pc-a button.dl{color:var(--ink2)}.pc-a button.dl svg{color:var(--red)}
.add{height:54px;border-radius:var(--r);background:#fff;border:1.5px dashed #C3C8D1;color:var(--ink);font-size:15.5px}
.add:hover{border-color:var(--red)}
/* daftar lost time */
.ltl{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--line2);cursor:pointer}
.ltl:last-of-type{border-bottom:0}
.ltl .tx{flex:1;min-width:0}.ltl .tx b{display:block;font-size:15px}.ltl .tx small{display:block;font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ltl .mn{font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.ltl .mn.no{color:var(--warn)}
.ltl>svg{flex:none;color:var(--muted)}
.ltcard{padding:6px 14px 14px}
.ltcard .add{margin-top:6px;height:50px}
/* layar penuh edit part / lost time */
.scr{position:fixed;inset:0;z-index:30;background:#fff;display:none;flex-direction:column}
.scr.open{display:flex}
.scr-h{background:var(--red);color:#fff;display:flex;align-items:center;gap:8px;padding:10px 8px calc(10px);padding-top:calc(10px + env(safe-area-inset-top));flex:none}
.scr-h h2{flex:1;margin:0;font-size:19px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scr-h button{width:44px;height:44px;border:0;background:none;color:#fff;display:grid;place-items:center;cursor:pointer;border-radius:12px}
.scr-h button:active{background:rgba(255,255,255,.15)}
.scr-b{flex:1;overflow:auto;padding:14px 16px 24px;max-width:760px;width:100%;margin:0 auto;-webkit-overflow-scrolling:touch}
.scr-f{flex:none;padding:12px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:#fff}
.scr-f .btn{width:100%;justify-content:center;max-width:728px;margin:0 auto;display:flex}
.scr .lb{font-size:14px;font-weight:700;color:var(--ink);margin-bottom:8px}
.scr .lb small{font-weight:500;color:var(--muted)}
.ltb>.f+.f,.scr .gap{margin-top:16px}
.pair .grid.g2{align-items:end}
.idc input::-webkit-calendar-picker-indicator{display:none}
.idrow{grid-template-columns:minmax(0,1.12fr) minmax(0,1fr);gap:8px}.idc{padding:10px;gap:8px}.idc>svg{width:22px;height:22px}.idc input{font-size:14.5px;letter-spacing:-.01em}
#existing{margin-bottom:12px}#existing .notice{margin-bottom:10px}
/* kategori: 2 kolom, centang di yang dipilih */
.cchips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.cchips button{min-height:46px;border-radius:12px;padding:6px 12px;font-size:14px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:8px;text-align:left;line-height:1.2}
.cchips button.on{background:var(--pink);border-color:var(--red);color:var(--red-d);box-shadow:none}
.cchips button .ck{flex:none;width:20px;height:20px;border-radius:50%;background:var(--red);color:#fff;display:grid;place-items:center}
.in,.pick{height:50px;border-radius:var(--rs);font-size:15.5px}
.pick:disabled{background:#F1F3F6}
.in:focus,.pick:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(155,27,31,.12)}
.seg button{height:44px;border-radius:11px}
.mcg button{min-height:52px}
.sub{margin:20px 0 10px;font-size:14px;color:var(--ink);font-weight:800}
.sub::after{display:none}
.pairs{grid-template-columns:1fr 1fr;gap:10px}
.pair{border:1px solid #F5D3D4;background:var(--pink);border-radius:var(--rs);padding:12px 10px}
.pair .ph{font-size:15px;font-weight:800;color:var(--red-d);justify-content:flex-start;gap:7px;align-items:center;margin-bottom:10px}
.pair.ot{background:var(--blue-soft);border-color:#D6E3FD}.pair.ot .ph{color:var(--blue)}
.pair .grid.g2{gap:6px}
.pair .lb{font-size:12.5px;font-weight:500;color:var(--ink2);margin-bottom:5px;font-weight:600}
.pair .in{height:46px;padding:0 10px;background:#fff}
.ng-t{min-height:54px;border-radius:var(--rs);border:1px solid var(--line);background:#fff;font-size:15px;font-weight:700;margin-top:16px}
.ngr{border-radius:var(--rs);min-height:54px}
.stp button{width:42px;height:42px;border-radius:11px}
.stp input{height:42px;width:60px;font-size:16px}
/* lost time editor */
.dur{display:grid;grid-template-columns:52px minmax(0,1fr) 64px 52px;gap:8px;align-items:center}
.dur button{height:52px;border-radius:12px;border:1.5px solid var(--line);background:#fff;font-size:24px;font-weight:500;color:var(--ink2);cursor:pointer}
.dur button.pl{color:var(--red)}
.dur input{height:52px;border:1.5px solid var(--line);border-radius:12px;text-align:center;font-size:20px;font-weight:700;outline:none;width:100%;font-variant-numeric:tabular-nums}
.dur input:focus{border-color:var(--red)}
.dur span{height:52px;border-radius:12px;background:var(--line2);display:grid;place-items:center;font-weight:600;color:var(--ink2)}
.scr textarea.in{min-height:90px}
.qchips{margin-top:0}
.qchips button{min-height:44px;border-radius:99px;padding:0 16px;font-size:14px;color:var(--ink);font-weight:500}
.qchips button.on{background:var(--pink);border-color:var(--red);color:var(--red-d);font-weight:700}
.scr .notice{margin:0 0 16px;border:1px solid #F7DDBA}
.scr .notice.ok{border-color:#C9EBDB}
/* bar bawah */
.bar{box-shadow:0 -6px 20px rgba(16,24,40,.06)}
.bar-in{padding:10px 16px calc(10px + env(safe-area-inset-bottom))}
.btn{height:52px;border-radius:14px;font-size:15.5px}
@media(max-width:380px){.btn{padding:0 14px;font-size:14.5px}.bar-sum b{font-size:13px}.mt-l b{font-size:21px}.pc-a button{font-size:12.5px;gap:5px}.pair{padding:10px 8px}.pair .in{padding:0 8px}}
@media(min-width:640px){.cchips{grid-template-columns:repeat(3,minmax(0,1fr))}}
/* ---- Tampilan v4.1 (gabungan desain A + C): header gelap dengan sisa menit besar, kartu part bersih,
   editor muncul dari bawah, tombol kirim terisi sampai 480 menit. Hanya tampilan; logika tetap ---- */
body.mem{--dk:#1C1D22;--dk2:#2A2B31;--dk3:#3A3B44;--soft:#C7C8D0}
body.mem .hero{background:var(--dk)}
body.mem .hero .accent{display:none}
body.mem .hero p{color:var(--soft)}
body.mem .hero .ver{color:#9A9CA8}
body.mem .band{background:var(--dk);box-shadow:0 0 0 100vmax var(--dk);padding:4px 16px 34px}
body.mem .idc{background:var(--dk2);border:1px solid var(--dk3);color:#fff}
body.mem .idc>svg{color:#F5A3A8}
body.mem .idc small{color:var(--soft);opacity:1}
body.mem .band .meter{background:none;border:0;box-shadow:none;padding:18px 2px 0;color:#fff}
.hm{display:flex;align-items:flex-end;gap:12px}
.hm-l{flex:1;min-width:0}
.hm-l small{display:block;font-size:13.5px;color:var(--soft)}
.hm-n{display:flex;align-items:baseline;gap:8px;margin-top:2px}
.hm-n b{font-size:44px;line-height:1.05;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;transition:color .3s}
.hm-n span{font-size:16px;font-weight:600;color:var(--soft)}
.hm-n b.ok{color:#4ADE80}.hm-n b.ov{color:#FBBF24}
.hm-r{flex:none;text-align:right;font-size:13px;color:var(--soft);padding-bottom:6px}
.hm-r b{font-size:18px;color:#fff;font-variant-numeric:tabular-nums}
.hm-bar{height:12px;border-radius:99px;background:var(--dk3);display:flex;gap:2px;overflow:hidden;margin:14px 0 9px}
.hm-bar i{display:block;height:100%;width:0;transition:width .7s cubic-bezier(.2,.8,.2,1)}
.hm-bar .p{background:#E0242E}.hm-bar .l{background:#F5A3A8}
.hm-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--soft)}
.hm-leg b{color:#fff;font-weight:700}
.hm-leg span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:3px;margin-right:6px;background:#E0242E}
.hm-leg span.l::before{background:#F5A3A8}.hm-leg span.o::before{background:#60A5FA}
body.mem .band .notice{color:var(--ink)}
/* kartu part ala desain A */
body.mem .pcard{border:0;border-radius:18px;box-shadow:0 1px 2px rgba(20,20,30,.04),0 6px 18px rgba(20,20,30,.06);transition:box-shadow .2s ease,transform .15s ease}
body.mem .pcard.invalid{box-shadow:0 0 0 1.5px var(--red),0 6px 18px rgba(20,20,30,.06)}
body.mem .pc-h .badge{width:42px;height:42px;border-radius:12px;background:#FBEAEB;color:var(--red);font-size:16px}
.pc-h .pm{flex:none;text-align:right;line-height:1.15}
.pc-h .pm b{display:block;font-size:16px;font-weight:800;font-variant-numeric:tabular-nums}
.pc-h .pm small{font-size:12px;color:var(--muted)}
body.mem .pc-a{padding:0 12px 12px}
body.mem .pc-a button{height:42px;border:0;background:#F5F6F8;border-radius:12px}
body.mem .add{border-color:#D9B3B6;background:#FFF8F8;color:var(--red);border-radius:18px}
body.mem .card{border:0;border-radius:18px}
/* editor muncul dari bawah (bottom sheet) */
body.mem .scr{background:rgba(15,15,20,.45);align-items:flex-end;justify-content:center}
body.mem .scr.open{animation:shFade .22s ease both}
.scr-p{width:100%;max-width:760px;max-height:94vh;max-height:94dvh;background:#fff;border-radius:24px 24px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:shUp .34s cubic-bezier(.2,.9,.25,1) both;box-shadow:0 -10px 40px rgba(0,0,0,.18)}
.scr-p::before{content:"";display:block;width:42px;height:5px;border-radius:3px;background:#DCDCE3;margin:8px auto 0;flex:none}
body.mem .scr-h{background:#fff;color:var(--ink);padding:4px 8px 6px;border-bottom:1px solid var(--line2)}
body.mem .scr-h button{color:var(--ink2)}
body.mem .scr-h button:active{background:var(--line2)}
body.mem .scr-h #scrDel{color:var(--red)}
@keyframes shUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes shFade{from{background:rgba(15,15,20,0)}to{background:rgba(15,15,20,.45)}}
/* tombol kirim terisi sampai 480 */
body.mem #btnSend{position:relative;overflow:hidden;isolation:isolate;background:var(--dk2);box-shadow:0 8px 20px rgba(20,20,30,.2)}
#sFill{position:absolute;left:0;top:0;bottom:0;width:0;background:#B5121B;z-index:-1;transition:width .6s cubic-bezier(.2,.8,.2,1),background .3s}
#sFill.ok{background:#15803D}
#sFill.ok::after{content:"";position:absolute;top:0;bottom:0;width:40%;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.28),rgba(255,255,255,0));animation:shine 2.4s 1s ease-in-out infinite}
#sFill.ov{background:#B45309}
@keyframes shine{from{transform:translateX(-120%)}to{transform:translateX(320%)}}
/* animasi masuk (sekali saat halaman dibuka) */
.first .pcard,.first .add,.first .card,.first .sec-h{animation:riseIn .45s cubic-bezier(.2,.8,.2,1) both}
.first .pcard:nth-of-type(2){animation-delay:.06s}.first .pcard:nth-of-type(3){animation-delay:.12s}.first .pcard:nth-of-type(n+4){animation-delay:.18s}
@keyframes riseIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.done .ck svg path{stroke-dasharray:30;stroke-dashoffset:30;animation:ckDraw .45s .25s ease-out forwards}
@keyframes ckDraw{to{stroke-dashoffset:0}}
body.mem .done .ck{width:96px;height:96px;animation:pop .5s cubic-bezier(.2,.9,.3,1.2) both}
@media(max-width:380px){.hm-n b{font-size:38px}.pc-h .pm b{font-size:15px}}
@media(prefers-reduced-motion:reduce){#sFill.ok::after{display:none}}
</style>
</head>
<body>
<header class="hero">
  <div class="hero-in">
    <div class="logo"><img src="/logo-tki.png" alt="Takai"></div>
    <div class="t"><h1 id="hTitle">Laporan Produksi QA</h1><p id="hSub">Quality Assurance • Input harian</p><small class="ver">%%VERSI%%</small></div>
    <div class="hero-r"><a class="mode" id="modeLink" href="#" target="_top" style="display:none"></a><button type="button" class="hlo" id="hLogout" title="Keluar" aria-label="Keluar" onclick="keluar()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button></div>
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span id="sFill"></span></button>
  </div>
</div>

<section class="scr" id="scr" role="dialog" aria-modal="true" onclick="if(event.target===this)scrBack()"><div class="scr-p">
  <div class="scr-h"><button type="button" aria-label="Kembali" onclick="scrBack()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg></button><h2 id="scrT"></h2><button type="button" id="scrDel" aria-label="Hapus" onclick="scrDel()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button></div>
  <div class="scr-b" id="scrB"></div>
  <div class="scr-f"><button type="button" class="btn" id="scrOk" onclick="scrSave()"></button></div>
</div></section>

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
// Login NIK (Vercel): operator terkunci ke namanya sendiri; leader/admin tetap boleh memilih member.
var ME=(window.BOOT&&BOOT.user)||null,LOCK=!!(ME&&ME.lock);
function keluar(){if(!confirm('Keluar dari akun '+ME.name+'?'))return;fetch('/api/auth/logout',{method:'POST'}).then(function(){location.href='/masuk';},function(){location.href='/masuk';});}
var IC = {
  cal:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg>',
  user:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  clock:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  clk:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  gear:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  edit:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  right:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  ck:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',

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
function savedMember(){if(LOCK)return ME.name;try{var m=localStorage.getItem(MEMBER_KEY)||'';return M.members.indexOf(m)>=0?m:'';}catch(e){return '';}}
function saveMember(m){try{localStorage.setItem(MEMBER_KEY,m);}catch(e){}
}
function saveDraft(){try{if(M&&M.today)S.savedOn=M.today;localStorage.setItem(DRAFT_KEY,JSON.stringify(S));}catch(e){}}
function loadDraft(){try{var d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(d&&d.items){d.op=d.op||{min:'',ot:'',auto:true};d.items.forEach(function(i){uid=Math.max(uid,i.id);if(i.mcMin===undefined){i.mcMin=i.normalMin;i.mcOtMin=i.otMin;}});(d.lost||[]).forEach(function(i){uid=Math.max(uid,i.id);});return d;}}catch(e){}return null;}
function clearDraft(){try{localStorage.removeItem(DRAFT_KEY);}catch(e){}}

/* ---------- render ---------- */
var EDP=null,EDL=null; // part / lost time yang sedang dibuka di layar edit
function render(){
  var h='';
  h+='<div class="band"><div class="idrow">';
  h+='<label class="idc" data-k="date">'+IC.cal+'<div class="tx"><small>Tanggal</small><input type="date" value="'+esc(S.date)+'" onclick="try{this.showPicker()}catch(e){}" onchange="S.date=this.value;this.closest(\'.idc\').classList.remove(\'err\');changed(true)"></div></label>';
  if(LOCK)h+='<div class="idc" data-k="member">'+IC.user+'<div class="tx"><small>Nama member</small><b>'+esc(ME.name)+'</b></div></div>';
  else h+='<button type="button" class="idc" data-k="member" onclick="pickMember()">'+IC.user+'<div class="tx"><small>Nama member</small><b'+(S.member?'':' class="ph"')+'>'+esc(S.member||'Pilih nama Anda')+'</b></div></button>';
  h+='</div><div class="meter" id="meter"></div></div><div class="pane"><div id="existing"></div><div id="hist" class="subs" style="margin-top:12px"></div>';
  if(S.editId)h+='<div class="notice" style="margin-top:14px">'+IC.warn+'<div style="flex:1"><b>Sedang mengedit kiriman '+esc(fmtDate(S.date))+'</b> yang masih menunggu leader. Simpan untuk mengganti kiriman lama.<br><button class="btn ghost sm-btn" onclick="batalEdit()">Batal edit</button></div></div>';

  h+='<div class="sec-h"><h2>Pekerjaan produksi</h2><span class="cnt">'+S.items.length+' part</span></div>';
  S.items.forEach(function(it,ix){h+=partCard(it,ix);});
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

  h+='<div class="sec-h" id="ltSec"><h2>Lost time / Another job</h2><span class="cnt">'+(S.lost.length?S.lost.length+' catatan':'0 catatan')+'</span></div>';
  h+='<div class="card ltcard">'+(EDL==null?'<div id="ltGap" style="padding-top:8px"></div>':'');
  if(!S.lost.length)h+='<div class="empty" style="padding-top:10px">Belum ada lost time. Wajib bila waktu kerja kurang dari '+M.normalMin+' menit.</div>';
  if(S.lost.some(function(l){return l.auto;}))h+='<p class="hint" style="margin:8px 0 0">5S, Briefing Pagi, dan Input Laporan sudah terisi otomatis. Ubah menitnya bila berbeda.</p>';
  else if(DROPPED===S.date+'|'+S.member&&!S.lost.some(function(l){return DEF_LT.some(function(d){return d[0]===l.type;});}))
    h+='<div class="notice ok" style="margin:10px 0 4px"><div style="flex:1">5S, Briefing Pagi, dan Input Laporan sudah tercatat di kiriman sebelumnya hari ini, jadi tidak diisi lagi agar tidak dobel.<br><button class="btn ghost sm-btn" onclick="tambahDefLt()">'+IC.plus+' Tetap tambahkan</button></div></div>';
  S.lost.forEach(function(l,ix){
    var grp=(M.lostGroups||{})[l.type]||'';
    h+='<div class="ltl" id="lt'+l.id+'" onclick="openLtEd('+ix+')"><div class="tx"><b>'+esc(l.type||'Pilih jenis')+'</b><small>'+esc([grp,l.remarks].filter(Boolean).join(' • ')||'Ketuk untuk mengubah')+'</small></div>'
      +'<span class="mn'+(n(l.minutes)?'':' no')+'">'+(n(l.minutes)?fmt(n(l.minutes))+' mnt':'– mnt')+'</span>'+IC.right+'</div>';
  });
  h+='<button class="add" onclick="S.lost.push(newLt());changed();openLtEd(S.lost.length-1)">'+IC.plus+' Tambah lost time</button>';
  h+='</div></div>';
  var ap=$('app');ap.innerHTML=h;
  if(!ap.dataset.an){ap.dataset.an='1';ap.classList.add('first');setTimeout(function(){ap.classList.remove('first');},900);}
  renderScr();
  updateBar();
  checkExisting();
  loadHist();
}
function pcMin(it){var m=isMc(it)?n(it.mcMin)+n(it.mcOtMin):n(it.normalMin)+n(it.otMin);return m?'<span class="pm"><b>'+fmt(m)+'</b><small>menit</small></span>':IC.right;}
function partCard(it,ix){
  return '<div class="pcard" id="li'+it.id+'"><div class="pc-h" onclick="openPart('+ix+')"><div class="badge">'+(ix+1)+'</div>'
    +'<div class="ttl"><b>'+esc(it.part||'Part baru')+(it.type&&it.type!=='-'?' <span style="color:var(--muted);font-weight:600">'+esc(it.type)+'</span>':'')+'</b><small>'+esc(itemSummary(it))+'</small></div>'+pcMin(it)+'</div>'
    +'<div class="pc-a"><button type="button" onclick="dupItem('+ix+')">'+IC.copy+' Salin</button><button type="button" onclick="openPart('+ix+')">'+IC.edit+' Edit</button><button type="button" class="dl" onclick="delItem('+ix+')">'+IC.del+' Hapus</button></div></div>';
}
/* ---------- layar edit part / lost time ---------- */
function openPart(ix){EDP=ix;EDL=null;render();$('scrB').scrollTop=0;}
function openLtEd(ix){EDL=ix;EDP=null;render();$('scrB').scrollTop=0;}
function renderScr(){
  var s=$('scr'),b=$('scrB');
  if(EDP!=null&&!S.items[EDP])EDP=null;
  if(EDL!=null&&!S.lost[EDL])EDL=null;
  if(EDP==null&&EDL==null){if(s.classList.contains('open')){s.classList.remove('open');document.body.style.overflow='';}return;}
  var st=s.classList.contains('open')?b.scrollTop:0;
  s.classList.add('open');document.body.style.overflow='hidden';
  if(EDP!=null){$('scrT').textContent='Tambah / Edit Part';$('scrOk').textContent='Simpan part';b.innerHTML=itemHtml(S.items[EDP],EDP);}
  else{$('scrT').textContent='Tambah Lost Time';$('scrOk').textContent='Simpan lost time';b.innerHTML=ltBody(EDL);}
  b.scrollTop=st;
}
function ltBody(ix){
  var l=S.lost[ix],grp=(M.lostGroups||{})[l.type]||'',h='<div class="ltb"><div id="ltGap"></div>';
  h+='<div class="f" data-k="type"><span class="lb">Kategori Lost Time <span class="req">*</span></span>'+pickBtn(l.type,'Pilih jenis','pickLt('+ix+')')+(grp?'<span class="tag'+(/^lost/i.test(grp)?' lt':'')+'">'+esc(grp)+'</span>':'')+'</div>';
  h+='<div class="f" data-k="minutes"><span class="lb">Durasi <span class="req">*</span></span><div class="dur"><button type="button" aria-label="Kurangi 5 menit" onclick="stepLt('+ix+',-5)">&minus;</button>'
    +'<input id="lti'+l.id+'" inputmode="decimal" placeholder="0" value="'+esc(l.minutes)+'" oninput="S.lost['+ix+'].minutes=this.value;S.lost['+ix+'].auto=false;this.closest(\'.f\').classList.remove(\'err\');changed()"><span>mnt</span>'
    +'<button type="button" class="pl" aria-label="Tambah 5 menit" onclick="stepLt('+ix+',5)">+</button></div></div>';
  h+='<label class="f"><span class="lb">Keterangan <small>(opsional)</small></span><textarea class="in" placeholder="Tuliskan keterangan…" oninput="S.lost['+ix+'].remarks=this.value;changed()">'+esc(l.remarks)+'</textarea></label>';
  var qk=quickLt(),cur=M.lostTypes.indexOf(l.type);
  if(cur>=0)qk=[cur].concat(qk.filter(function(i){return i!==cur;}));
  if(qk.length)h+='<div class="f gap"><span class="lb">Sering dipakai</span><div class="qchips">'+qk.map(function(i){return '<button type="button" class="'+(i===cur?'on':'')+'" onclick="setLtType('+ix+','+i+')">'+(i===cur?'':'+ ')+esc(M.lostTypes[i])+'</button>';}).join('')+'</div></div>';
  return h+'</div>';
}
function setLtType(ix,i){var l=S.lost[ix];l.type=M.lostTypes[i];l.auto=false;changed();render();}
function scrClose(){EDP=null;EDL=null;changed();render();}
function scrBack(){
  if(EDL!=null){var l=S.lost[EDL];if(l&&!l.type&&!n(l.minutes)&&!String(l.remarks||'').trim())S.lost.splice(EDL,1);}
  scrClose();
}
function scrMark(key,msg){
  var el=$('scrB').querySelector('[data-k="'+key+'"]');
  if(el){el.classList.add('err');el.scrollIntoView({behavior:'smooth',block:'center'});}
  toast(msg);
}
// Cek satu part saat Simpan part (aturan sama dengan validasi saat kirim).
function itemErr(it){
  var c=cat(it.category),p=partOf(c,it.part);
  if(!it.category)return ['category','Kategori belum dipilih'];
  if(!it.part)return ['part','Part belum dipilih'];
  if(p&&p.types.length&&!it.type)return ['type','Type belum dipilih'];
  if(c&&c.machines.length&&(!it.mc||it.mc==='-'))return ['mc','MC No belum dipilih'];
  if(!n(it.normalQty)&&!n(it.otQty))return ['normalQty','Qty normal atau OT belum diisi'];
  if(isMc(it)){
    if(n(it.normalQty)&&!n(it.mcMin))return ['mcMin','Menit MC jalan (normal) belum diisi'];
    if(n(it.otQty)&&!n(it.mcOtMin))return ['mcOtMin','Menit MC jalan (OT) belum diisi'];
  } else {
    if(n(it.normalQty)&&!n(it.normalMin))return ['normalMin','Menit normal belum diisi'];
    if(n(it.otQty)&&!n(it.otMin))return ['otMin','Menit OT belum diisi'];
  }
  var ob=uraiOiban(it.oiban);if(ob.err)return ['oiban',ob.err];
  var li=lainIdx(c);if(li>=0&&n(it.ng[li])&&!String(it.ngNote||'').trim()){it.ngOpen=true;return ['ngNote','NG Lain-lain diisi, tulis catatan jenis NG-nya'];}
  return null;
}
function scrSave(){
  if(EDP!=null){
    var e=itemErr(S.items[EDP]);
    if(e){render();scrMark(e[0],e[1]);return;}
  } else if(EDL!=null){
    var l=S.lost[EDL];
    if(!l.type){scrMark('type','Pilih kategori lost time');return;}
    if(!n(l.minutes)){scrMark('minutes','Isi durasi (menit)');return;}
  }
  scrClose();
}
function scrDel(){
  if(EDP!=null){if(delItem(EDP))scrClose();return;}
  if(EDL!=null){if(!confirm('Hapus lost time ini?'))return;S.lost.splice(EDL,1);scrClose();}
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
  var h='<div class="itb" id="it'+it.id+'"><div>';
  h+='<div class="f" data-k="category"><span class="lb">Kategori <span class="req">*</span></span>';
  if(M.categories.length<=12){
    h+='<div class="cchips">'+M.categories.map(function(x,ci){var on=x.name===it.category;return '<button type="button" class="'+(on?'on':'')+'" onclick="setCat('+ix+','+ci+')">'+(on?'<span class="ck">'+IC.ck+'</span>':'')+esc(x.name)+'</button>';}).join('')+'</div>';
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
  if(c&&c.machines.length)h+='<div class="f" data-k="mc" style="margin-top:12px"><span class="lb">MC No <span class="req">*</span>'+(it.part?' <small style="font-weight:500;color:var(--muted)">mesin yang biasa jalan part ini ditaruh paling depan</small>':'')+'</span>'+mcChips(ix)+'</div>';
  h+='<div class="sub">Hasil kerja</div><div class="grid g2 pairs">';
  var mc=isMc(it);
  h+=pairHtml(ix,IC.gear+'Normal','normalQty',mc?'mcMin':'normalMin',it,mc);
  h+=pairHtml(ix,IC.clk+'Lembur (OT)','otQty',mc?'mcOtMin':'otMin',it,mc);
  h+='</div>';
  h+='<div class="grid g2" style="margin-top:12px">'
    +'<label class="f"><span class="lb">Lot</span><input class="in" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Contoh: 312608097" value="'+esc(it.lot)+'" oninput="setF('+ix+',\'lot\',this.value)"></label>'
    +'<label class="f" data-k="oiban"><span class="lb">Oiban</span><input class="in" inputmode="numeric" autocomplete="off" placeholder="Contoh: 1-6, 8" value="'+esc(it.oiban)+'" oninput="setF('+ix+',\'oiban\',this.value);var e=$(\'ob'+it.id+'\');if(e)e.innerHTML=oibanInfo(this.value)"><small class="ob-i" id="ob'+it.id+'">'+oibanInfo(it.oiban)+'</small></label></div>';
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
  return '<div class="pair'+(q==='otQty'?' ot':'')+'"><div class="ph">'+title+'</div><div class="grid g2">'
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
  var sm=$('li'+it.id);sm=sm&&sm.querySelector('.ttl small');if(sm)sm.textContent=itemSummary(it);
  if(el){var f=el.querySelector('[data-k="'+k+'"]');if(f)f.classList.remove('err');}
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
  if(key)c.machines.forEach(function(m){var f=info[m]||{};if(mcRuns(f.main,key))list.push([m,'mesin utama','']);});
  if(key)c.machines.forEach(function(m){var f=info[m]||{};if(!mcRuns(f.main,key)&&mcRuns(f.alt,key))list.push([m,'bisa ganti type','alt']);});
  list=list.slice(0,7);
  if(it.mc&&it.mc!=='-'&&!list.some(function(x){return x[0]===it.mc;}))list.unshift([it.mc,'','']);
  var h='<div class="mcg">';
  list.forEach(function(x){h+='<button type="button" class="'+(it.mc===x[0]?'on':'')+'" onclick="setF('+ix+',\'mc\',\''+esc(x[0])+'\',true)">'+esc(x[0])+(x[1]?'<small class="'+x[2]+'">'+x[1]+'</small>':'')+'</button>';});
  h+='<button type="button" class="more" onclick="pickMc('+ix+')">'+(list.length?'Mesin lain…':'Pilih MC…')+'</button>';
  return h+'</div>';
}
function toggleItem(ix){S.items[ix].open=!S.items[ix].open;changed();render();}
function addItem(){
  var last=S.items[S.items.length-1];
  S.items.push(newItem(last?last.category:''));changed();openPart(S.items.length-1);
}
function dupItem(ix){
  var src=S.items[ix],it=newItem(src.category);it.mc=src.mc;
  S.items.splice(ix+1,0,it);changed();openPart(ix+1);toast('Part baru dengan kategori '+(src.category||'sama')+' ditambahkan');
}
function delItem(ix){
  if(!confirm(S.items.length>1?'Hapus part #'+(ix+1)+'?':'Kosongkan part #1?'))return false;
  if(S.items.length>1)S.items.splice(ix,1);else S.items=[newItem('')];
  changed();render();return true;
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
  var sf=$('sFill');if(sf){var tt=m+lt;sf.style.width=(hasWork?Math.min(100,tt/M.normalMin*100):0)+'%';sf.className=hasWork&&rest===0&&!overOt?'ok':rest<0?'ov':'';}
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
  if(!el.querySelector('.hm-bar'))el.innerHTML='<div class="hm"><div class="hm-l"><small>Waktu kerja hari ini</small><div class="hm-n"><b id="hmN"></b><span id="hmT"></span></div></div><div class="hm-r"><b id="hmTot"></b> / '+N+'</div></div>'
    +'<div class="hm-bar"><i class="p" id="hmP"></i><i class="l" id="hmL"></i></div><div class="hm-leg" id="hmLeg"></div>';
  var nb=$('hmN');
  if(!hasWork||rest>0){nb.textContent=fmt(hasWork?rest:N);nb.className='';$('hmT').textContent='menit lagi';}
  else if(rest===0){nb.textContent=fmt(N);nb.className='ok';$('hmT').textContent='menit, lengkap';}
  else{nb.textContent='+'+fmt(-rest);nb.className='ov';$('hmT').textContent='menit kelebihan';}
  $('hmTot').textContent=fmt(tot);
  $('hmP').style.width=(m/sc*100)+'%';$('hmL').style.width=(lt/sc*100)+'%';
  $('hmLeg').innerHTML='<span>Produksi <b>'+fmt(m)+'</b> menit</span><span class="l">Lost time <b>'+fmt(lt)+'</b> menit</span>'+(o?'<span class="o">Lembur <b>'+fmt(o)+'</b> menit</span>':'');
}
function gapMinutes(){var m=workMin(),lt=0;S.lost.forEach(function(l){lt+=n(l.minutes);});return M.normalMin-m-lt;}
function fillGap(rest){
  var ix=-1;S.lost.forEach(function(l,i){if(ix<0&&!n(l.minutes))ix=i;});
  if(ix>=0)S.lost[ix].minutes=String(rest);else{var l=newLt();l.minutes=String(rest);S.lost.push(l);ix=S.lost.length-1;}
  changed();openLtEd(ix);
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
var DROPPED='';
function tambahDefLt(){S.lost=S.lost.concat(defLost().map(function(l){l.auto=false;return l;}));DROPPED='';changed();render();}
function dropAuto(r){
  var sudah=r.lt>0||(r.subs||[]).some(function(x){return x.status!=='Ditolak';}),key=S.date+'|'+S.member;
  if(sudah&&!S.lost.some(function(l){return l.auto;})){if(DROPPED===key)return false;DROPPED=key;render();return true;}
  if(!sudah){if(!DROPPED||S.lost.some(function(l){return l.auto;}))return false;DROPPED='';var add=defLost().filter(function(d){return !S.lost.some(function(l){return l.type===d.type;});});if(!add.length)return false;S.lost=add.concat(S.lost);saveDraft();render();return true;}
  S.lost=S.lost.filter(function(l){return !l.auto;});
  DROPPED=S.date+'|'+S.member;
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
function pickMember(){if(LOCK)return;openPick('Nama member',opts(M.members),S.member,function(v){S.member=v;saveMember(v);if(!S.lost.length&&!S.items.some(function(i){return i.part;}))S.lost=defLost();changed(true);render();});}
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
  o=o.concat(other);
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
    if(c&&c.machines.length&&it.part&&(!it.mc||it.mc==='-'))mark(ix,'mc',L+'MC No belum dipilih',ix);
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
  var ltFirst=null;
  S.lost.forEach(function(l,ix){
    if((!l.type||!n(l.minutes))&&ltFirst==null)ltFirst=ix;
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
    if(first&&first.sel!=null){EDP=first.sel;EDL=null;}else if(!first&&ltFirst!=null){EDL=ltFirst;EDP=null;}
    render();
    if(!first&&ltFirst!=null){var lt=S.lost[ltFirst];first={sel:null,key:!lt.type?'type':'minutes'};}
    if(first){
      var root=first.sel==null?(EDL!=null?$('scrB'):document):$('it'+S.items[first.sel].id);
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
var SENDING=false;
function send(){
  if(SENDING)return; // cegah kiriman dobel karena tombol diketuk berkali-kali
  var items=validate();if(!items){closeReview();return;}
  var b=$('btnConfirm');SENDING=true;b.disabled=true;b.innerHTML='<span class="spin"></span> Mengirim…';
  var payload={date:S.date,member:S.member,
    items:items.map(function(it){var o={category:it.category,part:it.part,type:it.type,mc:it.mc,normalQty:it.normalQty,normalMin:it.normalMin,otQty:it.otQty,otMin:it.otMin,lot:it.lot,oiban:it.oiban,ng:it.ng};if(String(it.ngNote||'').trim()&&lainIdx(cat(it.category))>=0&&n(it.ng[lainIdx(cat(it.category))]))o.ngNote=String(it.ngNote).trim();if(isMc(it)){o.mcMin=it.mcMin;o.mcOtMin=it.mcOtMin;}return o;}),
    lostTimes:S.lost.map(function(l){return {type:l.type,minutes:l.minutes,remarks:l.remarks};}),replaceId:S.editId||''};
  if(items.some(isMc))payload.op={min:S.op.min,ot:S.op.ot};
  call('submitReport',[payload],function(r){
    SENDING=false;b.disabled=false;b.textContent='Kirim laporan';closeReview();clearDraft();HIST.member='';
    $('doneMsg').textContent=r.replaced?'Perubahan kiriman '+S.member+' sudah disimpan dan tetap menunggu validasi leader.':r.prod+' part dan '+r.lt+' lost time untuk '+S.member+' sudah terkirim dan menunggu validasi leader. Data masuk ke Dashboard setelah disetujui.';
    S.editId='';HIST.list=null;existCache={};
    $('app').style.display='none';$('bar').style.display='none';$('done').style.display='block';window.scrollTo(0,0);
  },function(msg){SENDING=false;b.disabled=false;b.textContent='Kirim laporan';toast('Gagal mengirim: '+msg);});
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
    if(LOCK&&S.member!==ME.name)S=freshState(false); // draf milik member lain di HP yang sama tidak dipakai
    // draf dari hari sebelumnya: tanggal kembali ke hari ini (kecuali sedang mengedit kiriman lama)
    if(d&&S===d&&!S.editId&&S.savedOn!==M.today&&S.date!==M.today){
      var isi=S.items.some(function(i){return i.part;})||S.lost.some(function(l){return !l.auto;});
      if(!isi)S=freshState(true);else{S.date=M.today;setTimeout(function(){toast('Tanggal diganti ke hari ini. Ubah bila laporan ini untuk tanggal lain.');},600);}
    }
    document.body.classList.add('mem');
    if(ME)$('hLogout').classList.add('on');
    if(LOCK){var ob=document.querySelector('#done .btn.ghost');if(ob)ob.style.display='none';}
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
    if(LOCK)ml.style.display='none';
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
  var h='<div class="lg2"><div class="lg2-l"><div class="lg2-t"><div class="k">PT Takai Seiki Indonesia</div><h2>Validasi Laporan <em>Produksi</em></h2><i class="lg2-bar"></i><p>Periksa dan setujui laporan harian member sebelum masuk ke Dashboard.</p></div>'
    +'<div class="lg2-img"><img src="/login-bearing-900.webp" srcset="/login-bearing-480.webp 480w, /login-bearing-900.webp 900w" sizes="(min-width:641px) 360px, 100vw" width="900" height="600" alt="Produk bearing PT Takai Seiki Indonesia" fetchpriority="high" decoding="async"></div></div>'
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
