import type { Artifact, Configuration } from '../lib/public-contract';
import { formatBytes } from '../lib/presentation';

function webUrl(value:string|null|undefined) {
  if(!value)return null;
  try { const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null; } catch { return null; }
}
export default function ModelSources({artifact,config}:{artifact:Artifact;config:Configuration}) {
  const repository=webUrl(artifact.repository)??(artifact.repository&&/^[\w.-]+\/[\w.-]+$/.test(artifact.repository)?`https://huggingface.co/${artifact.repository}${artifact.revision?`/tree/${encodeURIComponent(artifact.revision)}`:''}`:null);
  if(config.execution_kind==='cloud')return <section className="model-sources" aria-labelledby="weight-source-title"><div><h2 id="weight-source-title">Hosted model source</h2><p>{config.cloud_provider} · {artifact.quantization}</p><small>This result tested a cloud endpoint, not a downloadable GGUF.</small></div><div>{repository?<a className="source-button" href={repository}>Open hosted model →</a>:<p>Source link not recorded.</p>}</div></section>;
  const links=artifact.files.filter(f=>webUrl(f.url));
  return <section className="model-sources" aria-labelledby="weight-source-title"><div><h2 id="weight-source-title">Get this tested model</h2><p>{artifact.quantization} · {formatBytes(artifact.total_bytes)} download{artifact.files.length>1?` · ${artifact.files.length} files required`:''}</p><small>Links follow the selected quant and configuration.</small></div><div className="weight-file-links">
    {artifact.files.map((f,i)=>{const url=webUrl(f.url);let name=f.name;if(url){try{name=decodeURIComponent(new URL(url).pathname.split('/').at(-1)??f.name);}catch{}}
      return <div key={f.name}>{url?<a className="source-button" href={url}>{artifact.files.length>1?`Download GGUF · part ${i+1} of ${artifact.files.length}`:'Download tested GGUF'} ↗</a>:<strong className="source-unresolved">Download source not verified</strong>}<small className="weight-filename">{name}</small></div>;
    })}
    {!artifact.files.length&&<p>Download source not recorded.</p>}
    {repository&&<a className="source-repository" href={repository}>Repository &amp; model card →</a>}
    {links.length>0&&<small className="source-verification">{artifact.files.some(f=>f.hash_type==='header_1m_sha256')?'Source matched using recorded file size and header fingerprint. The historical record does not include a full-file checksum.':artifact.provenance_status==='verified'?'Verified source for this recorded artifact.':'Recorded source for this artifact.'}</small>}
    {!links.length&&<small>We could not establish the exact source for these tested weights. A similarly named download may be different.</small>}
  </div></section>;
}
