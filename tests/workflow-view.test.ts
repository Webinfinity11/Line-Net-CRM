import {describe,expect,it} from "vitest";
import {customerProgress,executorBucket,executorProgress,managerProgress} from "@/lib/workflow-view";
const order={status:"in_progress" as const,assignees:[{userId:"a",doneAt:null},{userId:"b",doneAt:null}],visits:[{userId:"a",endedAt:null}]};
describe("personal workflow instead of whole-order status",()=>{
 it("keeps the unstarted colleague in to-start while the first person works",()=>{expect(executorBucket(order,"a")).toBe("active");expect(executorBucket(order,"b")).toBe("new");});
 it("moves an individual handover to submitted while colleagues continue",()=>{const partial={...order,assignees:[{userId:"a",doneAt:new Date()},{userId:"b",doneAt:null}]};expect(executorBucket(partial,"a")).toBe("done");expect(executorProgress(partial,"a").detail).toContain("კოლეგების");});
 it("distinguishes manager review from individual handover",()=>{expect(executorProgress({...order,status:"done"},"b").title).toContain("მენეჯერის");});
 it.each(["closed","cancelled"] as const)("archives %s regardless of visit state",status=>{expect(executorBucket({...order,status},"a")).toBe("closed");});
 it("does not count a past ended visit as currently working",()=>{expect(executorBucket({...order,visits:[{userId:"a",endedAt:new Date()}]},"a")).toBe("new");});
});
describe("client and manager next steps",()=>{
 it("does not call work finished before manager approval",()=>{expect(customerProgress("done",true,true).step).toBe(4);expect(customerProgress("closed",true,true).step).toBe(5);});
 it("does not claim a visit is scheduled without a date",()=>{expect(customerProgress("assigned",true,false).step).toBe(1);expect(customerProgress("assigned",true,true).step).toBe(2);});
 it("handles unprocessed and cancelled requests separately",()=>{expect(customerProgress("new",false,false).step).toBe(0);expect(customerProgress("cancelled",true,false).step).toBe(-1);});
 it("asks the manager to review notes and prices before closure",()=>{expect(managerProgress({...order,status:"done",triaged:true,scheduledAt:null}).detail).toContain("თანხა");});
});
