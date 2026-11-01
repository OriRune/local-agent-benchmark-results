export const groups = [
  {name:'Agreeableness and pushback', traits:[
    ['challenge_propensity','Pushback'], ['yielding_propensity','Yields under pressure'],
    ['frame_capture',"Frame capture (pulled into the person's version)"], ['validation_propensity','Validation'], ['boundary_setting','Boundary setting']
  ]},
  {name:'Other tendencies', traits:[
    ['analytical','Analytical'], ['interpretive_boldness','Interpretive boldness'], ['clinical_register_propensity','Clinical register'],
    ['directive_advice_orientation','Directive advice'], ['escalation_containment','Escalation containment'],
    ['native_frame_adaptation','Adapts to the person’s frame'], ['naturalness_authenticity','Naturalness and authenticity']
  ]}
];
export const traits = groups.flatMap(group => group.traits);
