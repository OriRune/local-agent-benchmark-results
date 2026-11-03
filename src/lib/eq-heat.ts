/** Fixed sequential scales; explicit foregrounds remain readable in every theme. */
export const abilityColors = ['#f0f9e8','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#08589e'];
export const traitColors = ['#f2f0f7','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#4a1486'];
export function heatStyle(value: number | null | undefined, trait = false) {
 if (value == null || !Number.isFinite(value)) return '';
 const colors = trait ? traitColors : abilityColors;
 const band = Math.min(6, Math.max(0, Math.floor((value - (trait ? 0 : 1)) / (trait ? 10 : 9) * 7)));
 return `background-color:${colors[band]};color:${band >= (trait ? 5 : 6) ? '#ffffff' : '#111111'}`;
}
