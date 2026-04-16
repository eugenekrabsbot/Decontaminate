// DB migration: fix payout_config for defaultDiscountCents and minimum_payout
require('fs').readFileSync('/home/ahoy/BackEnd/.env','utf8').split('\n').forEach(l=>{const p=l.split('=');if(p.length>=2)process.env[p[0].trim()]=p.slice(1).join('=').trim()});
const {Pool}=require('pg');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:false});
(async()=>{
  const c=await pool.connect();
  try{
    // Add default_discount_cents column if missing
    try{
      await c.query('ALTER TABLE payout_config ADD COLUMN IF NOT EXISTS default_discount_cents INTEGER NOT NULL DEFAULT 0');
      console.log('ALT:OK');
    }catch(e){console.log('ALT:',e.message.split('\n')[0]);}

    // Ensure minimum_payout_cents row has amount=1000
    const mp=await c.query("SELECT id,value FROM payout_config WHERE key='minimum_payout_cents'");
    if(mp.rows.length>0){
      const curr=(mp.rows[0].value&&mp.rows[0].value.amount)?parseInt(mp.rows[0].value.amount):750;
      console.log('min:',curr);
      if(curr<1000){
        await c.query("UPDATE payout_config SET value=jsonb_build_object('amount',1000),updated_at=NOW() WHERE key='minimum_payout_cents'");
        console.log('UPDis1000');
      }
    }else{
      await c.query("INSERT INTO payout_config (key,value) VALUES ('minimum_payout_cents',jsonb_build_object('amount',1000))");
      console.log('INSmin');
    }

    // Ensure default_discount_cents row exists
    const dr=await c.query("SELECT id,default_discount_cents FROM payout_config WHERE key='default_discount_cents'");
    if(dr.rows.length===0){
      await c.query("INSERT INTO payout_config (key,value,default_discount_cents) VALUES ('default_discount_cents','{}',0)");
      console.log('INSdisc');
    }else{
      console.log('discExists:',dr.rows[0].default_discount_cents);
    }

    const r=await c.query("SELECT key,value,default_discount_cents FROM payout_config WHERE key IN ('minimum_payout_cents','default_discount_cents')");
    console.log('FINAL:'+JSON.stringify(r.rows));
  }finally{c.release();await pool.end();}
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});
