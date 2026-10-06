import type { OrderStatus } from "@/db/schema";
export type ExecutorBucket = "new" | "active" | "done" | "closed";
type WorkOrder = { status: OrderStatus; assignees: {userId:string;doneAt:unknown}[]; visits:{userId:string;endedAt:unknown}[] };
export function executorBucket(order:WorkOrder,userId:string):ExecutorBucket {
 if(order.status==="closed"||order.status==="cancelled") return "closed";
 if(order.status==="done"||order.assignees.some(a=>a.userId===userId&&a.doneAt)) return "done";
 return order.visits.some(v=>v.userId===userId&&!v.endedAt)?"active":"new";
}
export function executorProgress(order:WorkOrder,userId:string) {
 const bucket=executorBucket(order,userId);
 if(order.status==="cancelled") return {title:"შეკვეთა გაუქმებულია",detail:"ამ შეკვეთაზე სამუშაო აღარ არის საჭირო."};
 if(order.status==="closed") return {title:"შემოწმებულია და დახურულია",detail:"მენეჯერმა სამუშაო მიიღო. დამატებითი მოქმედება არ არის საჭირო."};
 if(order.status==="done") return {title:"მენეჯერის შემოწმებას ელოდება",detail:"გუნდმა სამუშაო ჩააბარა. შემდეგი ეტაპია მენეჯერის დადასტურება."};
 if(bucket==="done") return {title:"თქვენი ნაწილი ჩაბარებულია",detail:"შეკვეთა კოლეგების მუშაობის დასრულებას ელოდება."};
 if(bucket==="active") return {title:"თქვენი სამუშაო მიმდინარეობს",detail:"დაამატეთ შესრულებული სერვისები და საჭირო მასალა; დასრულებისას ჩააბარეთ თქვენი ნაწილი."};
 return {title:"თქვენი სამუშაო დასაწყებია",detail:"ობიექტზე მისვლისას დააჭირეთ „დაწყებას“. კოლეგის დაწყება თქვენს ვიზიტს არ იწყებს."};
}
export const WORKFLOW_STEPS=["გაგზავნილია","მიღებულია","დაგეგმილია","მიმდინარეობს","სამუშაო შესრულებულია, მიმდინარეობს შემოწმება","დასრულებულია"];
export function customerProgress(status:OrderStatus,triaged:boolean,scheduled:boolean) {
 if(status==="cancelled") return {step:-1,detail:"შეკვეთა გაუქმებულია. საჭიროების შემთხვევაში შექმენით ახალი მოთხოვნა."};
 if(status==="closed") return {step:5,detail:"სამუშაო შემოწმებულია და შეკვეთა დახურულია."};
 if(status==="done") return {step:4,detail:"სამუშაო შესრულებულია. მენეჯერი ამოწმებს შედეგს; შეკვეთა ჯერ არ დახურულა."};
 if(!triaged) return {step:0,detail:"მოთხოვნა გაგზავნილია. მენეჯერი გადაამოწმებს დეტალებს და მიიღებს დასამუშავებლად."};
 if(status==="in_progress") return {step:3,detail:"გუნდი თქვენს მოთხოვნაზე მუშაობს. დასრულების შემდეგ შედეგს მენეჯერი შეამოწმებს."};
 if(status==="assigned"&&scheduled) return {step:2,detail:"ვიზიტი დაგეგმილია. თარიღი და დრო ქვემოთ არის მითითებული."};
 return {step:1,detail:status==="assigned"?"შემსრულებელი დანიშნულია. ვიზიტის დრო ჯერ დასაზუსტებელია.":"მოთხოვნა მიღებულია. შემდეგი ეტაპია შემსრულებლისა და ვიზიტის დროის განსაზღვრა."};
}
export function managerProgress(order:WorkOrder & {triaged:boolean;scheduledAt:unknown}) {
 if(order.status==="cancelled") return {title:"შეკვეთა გაუქმებულია",detail:"სამუშაო შეჩერებულია. ახალი მოთხოვნა ცალკე დაამუშავეთ."};
 if(order.status==="closed") return {title:"შემოწმებულია და დახურულია",detail:"სამუშაო მიღებულია; გადახდის მდგომარეობა ცალკე ფინანსურ ბლოკში ჩანს."};
 if(order.status==="done") return {title:"თქვენს შემოწმებას ელოდება",detail:"გადაამოწმეთ ჩაბარების შენიშვნები, სერვისები და თანხა, შემდეგ დაადასტურეთ და დახურეთ."};
 if(!order.triaged) return {title:"მოთხოვნა დასამუშავებელია",detail:"შეავსეთ კლიენტი და ობიექტი, შემდეგ დანიშნეთ შემსრულებელი."};
 if(!order.assignees.length) return {title:"შემსრულებელი დასანიშნია",detail:"შეარჩიეთ გუნდი და დაგეგმეთ ვიზიტის დრო."};
 if(order.status==="in_progress") return {title:"გუნდი მუშაობს",detail:"თითოეული წევრი თავის ნაწილს აბარებს. შემოწმება ყველას ჩაბარების შემდეგ იწყება."};
 return {title:order.scheduledAt?"ვიზიტი დაგეგმილია":"ვიზიტის დრო დასაზუსტებელია",detail:order.scheduledAt?"შემსრულებლები დანიშნულია; შემდეგი ეტაპია ობიექტზე სამუშაოს დაწყება.":"გუნდი დანიშნულია. მიუთითეთ ვიზიტის დრო, რომ კლიენტმაც ნახოს გეგმა."};
}
