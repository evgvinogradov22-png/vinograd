export const APP_NAME = "Виноград";

export const TABS = [
  { id:"pre",        label:"Препродакшн",  color:"#8b5cf6" },
  { id:"prod",       label:"Продакшн",     color:"#3b82f6" },
  { id:"post",       label:"Постпродакшн", color:"#ec4899" },
  { id:"pub",        label:"Публикация",   color:"#10b981" },
  { id:"admin",      label:"Адм. задачи",  color:"#f97316" },
  { id:"contentplan",label:"Контент-план", color:"#10b981" },
  { id:"calendar",   label:"Календарь",    color:"#06b6d4" },
  { id:"projects",   label:"Проекты",      color:"#f59e0b" },
  { id:"board",      label:"Доска",        color:"#a78bfa" },
  { id:"summary",    label:"Сводка",       color:"#f97316" },
  { id:"analytics",  label:"Аналитика",    color:"#a78bfa" },
  { id:"base",       label:"База",         color:"#06b6d4" },
];

export const PRE_STATUSES  = [{id:"idea",l:"Идея",c:"#6b7280"},{id:"brief",l:"Бриф",c:"#f59e0b"},{id:"script",l:"Сценарий",c:"#8b5cf6"},{id:"approved",l:"Утверждено",c:"#10b981"}];
export const PROD_STATUSES = [{id:"planned",l:"Запланировано",c:"#6b7280"},{id:"ready",l:"Готово к съёмке",c:"#f59e0b"},{id:"shooting",l:"Идёт съёмка",c:"#3b82f6"},{id:"done",l:"Снято",c:"#10b981"}];
export const POST_STATUSES = [{id:"not_started",l:"Не начат",c:"#4b5563"},{id:"in_progress",l:"В монтаже",c:"#f59e0b"},{id:"review",l:"На проверке",c:"#8b5cf6"},{id:"done",l:"Готово",c:"#10b981"}];
export const PUB_STATUSES  = [{id:"draft",l:"Черновик",c:"#6b7280"},{id:"ready",l:"Готово",c:"#f59e0b"},{id:"scheduled",l:"Запланировано",c:"#3b82f6"},{id:"published",l:"Опубликовано",c:"#10b981"}];
export const ADMIN_STATUSES = [{id:"new",l:"Новая",c:"#6b7280"},{id:"in_progress",l:"В работе",c:"#f59e0b"},{id:"waiting",l:"Ожидание",c:"#3b82f6"},{id:"done",l:"Выполнено",c:"#10b981"},{id:"cancelled",l:"Отменено",c:"#ef4444"}];

export const ROLES_LIST    = ["Директор","Менеджер проекта","Сценарист","Оператор","Монтажёр","Продюсер","Таргетолог","Дизайнер","Другое"];
export const MONTHS        = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
export const WDAYS         = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
export const AVATAR_COLORS = ["#ef4444","#3b82f6","#ec4899","#10b981","#f59e0b","#8b5cf6","#06b6d4","#f97316"];

export const pubCount = x => (x.pub_type==="carousel" ? 1 : Math.max(1, parseInt(x.reels_count)||1));

// Shared input styles
export const SI = {background:"#16161f",border:"1px solid #2d2d44",borderRadius:8,padding:"8px 11px",color:"#f0eee8",fontSize:12,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"};
export const LB = {fontSize:9,color:"#cbd5e1",fontWeight:700,letterSpacing:"0.1em",marginBottom:4,display:"block",fontFamily:"monospace"};
