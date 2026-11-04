const text = {type: 'string'};
const date = {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$'};
const url = {type: 'string', description: '已读取并核验内容的原始 HTTP(S) 来源；只有 URL 不构成真实性证明。'};
const number = {type: 'integer', minimum: 0};
const window = {windowStart: date, windowEnd: date, added: number, coverageComplete: {type: 'boolean'}, sourceUrl: url};
export const discoveryInputSchema = {
  type: 'object', additionalProperties: false, required: ['asOf', 'scopes', 'items'],
  properties: {
    asOf: {...date, description: '实际报告日期，Asia/Shanghai；相同输入产生相同选择。'},
    limit: {type: 'integer', minimum: 1, maximum: 20, default: 5},
    scopes: {type: 'array', maxItems: 20, items: {type: 'object', additionalProperties: false,
      required: ['id','label','query','sourceUrl','observedOn','windowStart','windowEnd','metric','members'], properties: {
        id: text, label: text, query: {...text, description: '看候选表现前确定的检索范围/查询或官方目录；不能为一个项目事后定制小圈子。'}, sourceUrl: url, observedOn: date,
        windowStart: date, windowEnd: date, metric: {enum: ['stars','downloads','participants','recognition_events']},
        members: {type: 'array', minItems: 1, items: text, description: '该次有界检索实际返回/审查的完整仓库名单，不是整个领域。每个成员都需提交 item；可记录被排除项目。'},
      }}},
    items: {type: 'array', maxItems: 200, items: {type: 'object', additionalProperties: false,
      required: ['fullName','scopeId','verifiedFields'], properties: {
        fullName: text, scopeId: text, ecosystem: {...text, description: '一致的产品生态或工作流分类，用于多样性组合；不是人为新颖度分数。'},
        scopeReason: {...text, description: '直接 AI 用途，或与重要产品/工作流的真实生态关系及原始资料依据。'},
        scopeRelevant: {type:'boolean'}, repositoryVerified: {type:'boolean'}, dedupEligible: {type:'boolean'}, minimumEvidenceSatisfied: {type:'boolean'},
        verifiedFields: {type:'array',items:text, description: '仅列真正核验过的 scopeRelevant, scopeReason, repositoryVerified, dedupEligible, minimumEvidenceSatisfied, trend, ecosystem；提供但未列出的字段报错。'},
        evidenceUrls: {type:'array',items:url, description:'仓库、README、官方文档等项目事实来源。'},
        trend: {oneOf: [
          {type:'object', additionalProperties:false, required:['kind','metric','windowStart','windowEnd','added','coverageComplete','sourceUrl','checkedOn'], properties:{
            kind:{const:'attention'},metric:{enum:['stars','downloads','participants']},...window,checkedOn:date,
            baseline:{type:'object',required:Object.keys(window),properties:window,additionalProperties:false},
          }},
          {type:'object', additionalProperties:false, required:['kind','eventType','occurredOn','sourceUrl','actor','description','independentOfProject','checkedOn'],properties:{
            kind:{const:'recognition'},eventType:{enum:['official_listing','integration','adoption']},occurredOn:date,sourceUrl:url,actor:text,description:text,independentOfProject:{const:true},checkedOn:date,
          }},
        ]},
      }}},
  },
};
