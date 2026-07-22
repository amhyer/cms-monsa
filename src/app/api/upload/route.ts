import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth";
const A=["image/jpeg","image/png","image/webp","image/gif","video/mp4"];const M=8*1024*1024;
export async function POST(r:NextRequest){const a=await requireAuth();if(!a.ok)return a.response;try{const f=await r.formData();const x=f.get("file");if(!(x instanceof File))return NextResponse.json({error:"File tidak ditemukan."},{status:400});if(x.size===0||x.size>M||!A.includes(x.type))return NextResponse.json({error:"File tidak valid."},{status:400});const e={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4"}[x.type]||"bin";const n=`${randomUUID()}.${e}`;const d=path.join(process.cwd(),"public","uploads");await mkdir(d,{recursive:true});await writeFile(path.join(d,n),Buffer.from(await x.arrayBuffer()));return NextResponse.json({url:`/uploads/${n}`});}catch(e){console.error("[upload]",e);return NextResponse.json({error:"Gagal mengunggah."},{status:500});}}
