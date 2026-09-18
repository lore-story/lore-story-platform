import { LAYOUTS } from './model'
export default function LayoutSelector({ value, hasImage, onChange }) {
  return <fieldset className="layout-selector"><legend>Layoutvorlage</legend><div>{Object.entries(LAYOUTS).map(([id,label])=><button type="button" key={id} className={value===id?'active':''} aria-pressed={value===id} onClick={()=>onChange(id)}><span className={`layout-mini mini-${id}`}><i/><i/></span><small>{label}</small></button>)}</div>{!hasImage&&value!=='text'&&<small role="status">Dieses Layout wirkt mit einem Bild am besten. Bis dahin erscheint eine neutrale Fläche.</small>}</fieldset>
}
