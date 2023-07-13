<script setup lang="ts">
import {onMounted, reactive, setTransitionHooks, watch} from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js"
import type { RunTrace } from "@/models/RunTrace";
import {useRouter, useRoute} from "vue-router";
import axios from "axios";
import Chart from 'chart.js/auto';
import Utils from 'chart.js/auto';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import ProgressBar from 'primevue/progressbar';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';


/**
 * 
 * We need a function that transforms the indexes of the tasks per process into menuItem-like objects
 * So we can use these menu items to toggle between the tasks in a process accordion
 * 
 * */


const router = useRouter();
const route = useRoute();

const props = defineProps<{
    token: string;
}>();

const workflowState = reactive<{
    loading: boolean;
    token: string;
    token_info_requested: boolean
    chart: any;
    error_on_request: boolean;
    process_state: any;
    state_by_task: any;
    //connection: WebSocket;
}>({
    loading: true,
    token: "",
    token_info_requested: false,
    chart: {},
    error_on_request: false,
    process_state: {},
    state_by_task: {},
    //connection: null,
});

function getData(token = props.token) {
    if (token.length > 0) {
        workflowState.loading = true;
        axios.get(`http://localhost:8000/run/${token}/`).then(
            response => {
                if (response.data["error"]) {
                    workflowState.state_by_task = [];
                    workflowState.error_on_request = true;

                } else {
                    workflowState.state_by_task = response.data["result_by_task"];
                    workflowState.process_state = response.data["result_processes"];
                    workflowState.token_info_requested = true;
                    workflowState.token = token;
                    workflowState.error_on_request = false;
                    generateChart();
                }
            },
        );
        //workflowState.connection = new WebSocket(`wss://localhost:8000/run/${token}`);
        //workflowState.connection. TODO: add websocket stuff

    }

}

function sortTraces(a: RunTrace, b: RunTrace): number {
    if (Date.parse(a.timestamp) < Date.parse(b.timestamp)) {
        return -1;
    } else {
        return 1;
    }
}

function getProgressValue(task: any): number {
    let x: number = 0
    if (task["status"] === "SUBMITTED") {
        x = 10
    } else if (task["status"] === "RUNNING") {
        x = 50
    } else if (task["status"] === "COMPLETED") {
        x = 100
    }
    return x;
}

function processNumbers(info: any): string {
    const  currently_submitted: number = getNumberOfTasksForProcess(info);
    const completed = getNumberOfCompletedSubprocesses(info);
    return `${completed} / ${currently_submitted}`;
}

function getNumberOfTasksForProcess(info: any): number {
    const subprocesses: any = info["tasks"];
    let currently_submitted: number = 0;
    for (let elem in subprocesses) {
        currently_submitted += 1;
    }
    return currently_submitted
}

function getProcessCurrentScore(info: any): number {
    const subprocesses: any = info["tasks"];
    let score: number = 0;
    for (let sb in subprocesses) {
        let status: string = subprocesses[sb]["status"];
        if (status == "SUBMITTED") {
            score += 10;
        } else if (status == "RUNNING") {
            score += 50;
        } else if (status == "COMPLETED") {
            score += 100;
        }   
    }
    return score;
}


function getNumberOfCompletedSubprocesses(info: any): number {
    const subprocesses: any = info["tasks"];
    let completed: number = 0;
    for (let sb in subprocesses){
        if (subprocesses[sb]["status"] === "COMPLETED") {
            completed += 1;
        }
    }
    return completed;
}

function deleteToken(token: string) {
  // needs implementation
}
/*
function generateChart() { OLD
    let x_data = workflowState.run_traces.map((trace: RunTrace) => Date.parse(trace.timestamp));
    let y_data = workflowState.run_traces.map((trace: RunTrace) => trace.memory);
    let data = workflowState.run_traces.map((trace: RunTrace) => new Object({"date": trace.timestamp, "memory": trace.memory }));
    const width = 800;
    const height = 500;
    // TODO: continue chart stuff here
} */

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

function generateData(): any[] {
    let data = [];
    for (let process in workflowState.process_state){
        const tasks = workflowState.process_state[process].tasks
        for (let tsk in tasks){
            data.push({process: process, duration: tasks[tsk]['duration']});
            break;
        } 
        
    }
    return data;
    
}

function generateCPUData(): any[] {
    let data: any[] = [];
    for (let process in workflowState.process_state) {
        let i = 0;
        const tasks = workflowState.process_state[process].tasks;
        for (let tsj in tasks){
            data.push({process: `process_${i}`, dta: 0})
        }
    }
    
    
    return data;


}

// how to combine the metrics from currentState and process state - what about meta? 
// more data from api needed - otherwise no possibility to show all relevant metrics
// check chart.js and available visualizations in nf-tower


async function generateChart() {
    // needs a lot of future adjustments
    let datax = generateData();
    await delay(100);
  new Chart(
    document.getElementById('chartarea'),
    {
      type: 'bar',
      options: {
        animation: false,
        plugins: {
          legend: {
            display: true
          },
          tooltip: {
            enabled: true
          }
          
        }
      },
      data: {
        labels: datax.map(row => row.process),
        datasets: [
          {
            label: 'Duration in seconds',
            data: datax.map(row => (row.duration / 1000))
          }
        ]
      }
    }
  );
  

}

async function generateCPUChart() {
    let data = generateCPUData();
}

onMounted(() => {
    getData();
});
</script>

<template>
    
  <div class="card" v-if="!workflowState.token || workflowState.error_on_request">
      <h5 class="card-header">Enter token</h5>
      <div class="card-body">
          <div class="alert"
              :class="{ 'alert-dark' : !workflowState.error_on_request, 'alert-danger': workflowState.error_on_request}">
              Please enter a valid token to show the corresponding workflow information for this token.
              <strong>The entered token is not valid.</strong>
          </div>
          <div class="input-group mb-3">
              <span class="input-group-text" id="basic-addon1">Token</span>
              <input v-model="workflowState.token" type="text" class="form-control" placeholder="Token" aria-label="token" aria-describedby="basic-addon1">
              <button @click="getData(workflowState.token)" class="btn btn-outline-primary" type="button">Show</button>
          </div>
      </div>
  </div>
  <div class="card" v-if="workflowState.token && workflowState.token_info_requested">
      <h5 class="card-header">Workflow information for token {{workflowState.token}}</h5>
      <div class="card-body" v-if="workflowState.state_by_task?.length == 0 && !workflowState.error_on_request">
          <h6 class="card-subtitle mb-2">
              There are no workflows connected to this token. Please use the following instructions to persist workflow metrics to this token.
          </h6>
          <div class="alert alert-dark">
              The following steps need to be taken:
              <ul>
                  <li>Take a look at the current token - the full token is: <strong>{{workflowState.token}}</strong> </li>
                  <li>Start your nextflow workflow as you are used to. Just add the following command line arguments to the execution:
                      <strong>{{`-with-weblog http://localhost:8000/run/${workflowState.token}/`}}</strong></li>
              </ul>
              So your command to execute will look similar to this: <br>
              <span class="text-muted">./nextflow run nextflow-io/elixir-workshop-21 -r master -with-docker -with-weblog http://localhost:8000/run/{{workflowState.token}}</span>
            <br>
              As soon as the first metrics have been sent to the token-specific-endpoint, you will be able to see the progress here.
          </div>
      </div>
      <div class="card-body" v-if="workflowState.token_info_requested && workflowState.state_by_task?.length > 0 && !workflowState.error_on_request && workflowState.process_state">
          <h5 class="card-title">By process</h5>
          <hr>

        <div  v-for="(info, process) in workflowState.process_state" :id="process + '_accordion'">
            <Accordion >
                <AccordionTab>
                    <template #header>
                        <span>{{process}} - {{processNumbers(info)}} Completed</span>
                        
                    </template>
                    <div>
                        <Card>
                            <template #title> Metrics </template>
                            <template #content>
                                <ProgressBar :value="(getProcessCurrentScore(info) / (getNumberOfTasksForProcess(info) * 100)) * 100"
            :pt="{
                root: { style: { height: '3px' } },
                value: {style: {height: '3px' } },     
                label: {style: { display: 'none' } },       }"
                ></ProgressBar>
                                <TabView>
                                    <TabPanel v-for="(task, id) in info['tasks']" :header="`#${id}`">
        
                                        <div class="table-responsive">
                                        <table class="table">
                                            <thead>
                                            <tr>
                                                <th scope="col">Name</th>
                                                <th scope="col">CPUs</th>
                                                <th scope="col">Memory</th>
                                                <th scope="col">Disk</th>
                                                <th scope="col">Duration</th>
                                                <th scope="col">Realtime</th>
                                                <th scope="col">wchar</th>
                                                <th scope="col">rchar</th>
                                                <th scope="col">rss</th>
                                                <th scope="col">%cpu</th>
                                                <th scope="col">%mem</th>
                                                <th scope="col">Virtual Memory</th>
                                                <th scope="col">peak VMem</th>
                                                <th scope="col">syscr</th>
                                                <th scope="col">syscw</th>
                                                <th scope="col">peak rss</th>
                                                <th scope="col">Read bytes</th>
                                                <th scope="col">Written bytes</th>
                                                <th scope="col">Voluntary CTXT</th>
                                                <th scope="col">Involuntary CTXT</th>
                                                
                                            </tr>
                                            </thead>
                                            <tbody>
                                            
                                            <tr>
                                                <th scope="row">{{`${process}${task['sub_task'] != null ? ':'  + task['sub_task'] : ''}`}}</th>
                                                <td>{{task["cpus"]}}</td>
                                                <td>{{task["memory"]}}</td>
                                                <td>{{task["disk"]}}</td>
                                                <td>{{(task["duration"] / 1000)}} s</td>
                                                <td>{{task["realtime"]}}</td>
                                                <td>{{task["wchar"]}}</td>
                                                <td>{{task["rchar"]}}</td>
                                                <td>{{task["rss"]}}</td>
                                                <td>{{task["cpu_percentage"]}}</td>
                                                <td>{{task["memory_percentage"]}}</td>                                            
                                                <td>{{task["vmem"]}}</td>
                                                <td>{{task["peak_vmem"]}}</td>
                                                <td>{{task["syscr"]}}</td>
                                                <td>{{task["syscw"]}}</td>
                                                <td>{{task["peak_rss"]}}</td>
                                                <td>{{task["read_bytes"]}}</td>
                                                <td>{{task["write_bytes"]}}</td>
                                                <td>{{task["vol_ctxt"]}}</td>
                                                <td>{{task["inv_ctxt"]}}</td>
                                                
                                            </tr>  
                                            </tbody>
                                        </table>
                                    </div>
                                    </TabPanel>
                                </TabView>
                            
                                </template> 
                                
                                
                        </Card>
                        
                            
                    </div>
                </AccordionTab>
            </Accordion>
            
        </div>
         
        
          <hr>
          <div class="card-body">
            <h5 class="card-title">Trace Information</h5>

            <DataTable :value="workflowState.state_by_task" sortField="task_id" :sortOrder="1" tableStyle="min-width: 50rem"
            paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" removableSort  
            >
                <Column field="task_id" header="Task-ID" sortable ></Column>
                <Column field="name" header="Name" sortable ></Column>
                <Column field="status" header="Status" sortable>
                    <template #body="{ data }">
                        <Tag :value="data.status"/>
                    </template></Column>
                <Column field="process" header="Process" sortable></Column>
                <Column field="tag" header="Tag" sortable></Column>
                <Column field="timestamp" header="Timestamp" sortable></Column>
                <Column field="duration" sortable header="Duration">
                    <template #body="{ data }">
                       {{(data.duration / 1000)}} s
                    </template></Column>
                    <Column field="cpu_percentage" header="CPU %" sortable></Column>
                    <Column field="memory_percentage" header="Memory %" sortable></Column>
                    <Column field="disk" header="Disk"></Column>
                    <Column field="rchar" header="rchar" sortable></Column>
                    <Column field="wchar" header="wchar" sortable></Column>
                    <Column field="rss" header="rss" sortable></Column>
                    <Column field="peak_rss" header="Peak rss" sortable></Column>
                    <Column field="syscr" header="syscr" sortable></Column>
                    <Column field="syscw" header="syscw" sortable></Column>
                    <Column field="peak_vmem" header="Peak VMem" sortable></Column>
                    <Column field="vmem" header="VMem" sortable></Column>
                    <Column field="read_bytes" header="Read bytes" sortable></Column>
                    <Column field="write_bytes" header="Written bytes" sortable></Column>
                    <Column field="vol_ctxt" header="Voluntary context switches" sortable></Column>
                    <Column field="inv_ctxt" header="Involuntary cs" sortable></Column>
                    <Column field="time" header="Time" sortable></Column>
                    <Column field="realtime" header="Realtime" sortable></Column>
                    <Column field="tag" header="Tag" sortable></Column>
            </DataTable>
          </div>
      </div>
      <div class="card-body">
        <h5 class="card-title">Visualization</h5>
        <h6>Duration</h6> <!-- adjust to have this in chartjs itself -->
        <div style="width: 800px;"><canvas id="chartarea"></canvas></div>
      </div>
      <hr>
      <div class="card-body">
        <h6>CPU usage</h6>
        <div style="width: 800px;"><cavas id="cpu_chart_area"></cavas></div>
      </div>
      <div class="card-body" v-if="workflowState.token_info_requested && !workflowState.error_on_request">
      <div type="button" class="btn btn-outline-danger" @click="deleteToken(workflowState.token)">
          Delete token
      </div>

  </div>
    <div class="card-body" v-if="workflowState.error_on_request">
        <div class="alert alert-info">
            This token is not correct, please enter another token
        </div>
    </div>
    </div>


</template>

<style scoped>

</style>
