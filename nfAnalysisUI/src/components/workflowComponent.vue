<script setup lang="ts">
import {onMounted, reactive, watch} from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js"
import type { RunTrace } from "@/models/RunTrace";
import {useRouter, useRoute} from "vue-router";
import axios from "axios";



const router = useRouter();
const route = useRoute();

const props = defineProps<{
    token: string;
}>();

const workflowState = reactive<{
    loading: boolean;
    token: string;
    run_traces: RunTrace[];
    token_info_requested: boolean
    chart: any;
    error_on_request: boolean;
    current_state: any;
    process_state: any;
}>({
    loading: true,
    token: "",
    run_traces: [],
    token_info_requested: false,
    chart: {},
    error_on_request: false,
    current_state: {},
    process_state: {},
});

function getData(token = props.token) {
    if (token.length > 0) {
        workflowState.loading = true;
        axios.get(`http://localhost:8000/run/${token}/`).then(
            response => {
                if (response.data["error"]) {
                    workflowState.run_traces = []
                    workflowState.error_on_request = true;
                } else {
                    workflowState.run_traces = response.data["result_list"];
                    //workflowState.run_traces.sort(sortTraces);
                    workflowState.process_state = response.data["result_processes"];
                    workflowState.token_info_requested = true;
                    workflowState.token = token;
                    workflowState.error_on_request = false;
                    //generateChart();
                }
            },
        );
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
        score += subprocesses[sb]["status_score"]
    }
    return score;
}


function getNumberOfCompletedSubprocesses(info: any): number {
    const subprocesses: any = info["tasks"];
    let completed: number = 0;
    for (let sb in subprocesses) {
        if (subprocesses[sb]["status"] === "COMPLETED") {
            completed += 1;
        }
    }
    return completed;
}

function deleteToken(token: string) {
  // needs implementation
}

function generateChart() {
    let x_data = workflowState.run_traces.map((trace: RunTrace) => Date.parse(trace.timestamp));
    let y_data = workflowState.run_traces.map((trace: RunTrace) => trace.memory);
    let data = workflowState.run_traces.map((trace: RunTrace) => new Object({"date": trace.timestamp, "memory": trace.memory }));
    const width = 800;
    const height = 500;
    // TODO: continue chart stuff here
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
      <div class="card-body" v-if="workflowState.run_traces?.length == 0 && !workflowState.error_on_request">
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
      <div class="card-body" v-if="workflowState.token_info_requested && workflowState.run_traces?.length > 0 && !workflowState.error_on_request">
          <h5 class="card-title">By process</h5>
          <div class="accordion accordion-flush" v-for="(info, process) in workflowState.process_state" :id="process + '_accordion'">
              <div class="accordion-item">
                  <h2 class="accordion-header" :id="'header_' + process">
                      <button class="accordion-button" type="button" data-bs-toggle="collapse" :data-bs-target="'#collapse_' + process" aria-expanded="false" :aria-controls="'collapse_' + process">
                          {{process}} - {{processNumbers(info)}} Completed
                      </button>
                       <div class="progress" role="progressbar" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" style="height: 5px; border-radius: 0;">
                          <div class="progress-bar" :style="{width: parseInt(((getProcessCurrentScore(info) / (getNumberOfTasksForProcess(info) * 100)) * 100).toString()) + '%'}"></div>
                      </div>
                  </h2>
                  <div :id="'collapse_' + process" class="accordion-collapse collapse" :aria-labelledby="'header_' + process" data-bs-parent="#processAccordion">
                      <div class="accordion-body">
                          <ul class="list-group list-group-flush">
                              <li class="list-group-item align-items-start" v-for="(task, tid) in info['tasks']">
                                  <div class="row">
                                      <div class="col-6">
                                          <strong>#{{tid}} - {{`${process}${task['sub_task'] != null ? ':'  + task['sub_task'] : ''}`}}</strong>
                                          {{task['tag']}}
                                      </div>
                                      <div class="col-6">
                                          {{task['status']}}
                                      </div>
                                  </div>
                              </li>
                          </ul>
                          <div class="card">
                              <div class="card-header">
                                  <h6>Metrics</h6>
                                  <ul class="nav nav nav-pills card-header-pills">
                                      <li class="nav-item" v-for="(task, tid) in info['tasks']">
                                          <a class="nav-link" aria-current="true" href="#">#{{tid}}</a> <!-- add active when is -->
                                      </li>

                                  </ul>
                              </div>
                              <div class="card-body">
                                  <table class="table">
                                      <thead>
                                      <tr>
                                          <th scope="col">Name</th>
                                          <th scope="col">CPUs</th>
                                          <th scope="col">Memory</th>
                                          <th scope="col">Disk</th>
                                          <th scope="col">Duration</th>
                                      </tr>
                                      </thead>
                                      <tbody>
                                      <tr v-for="task in info['tasks']">
                                          <th scope="row">{{`${process}${task['sub_task'] != null ? ':'  + task['sub_task'] : ''}`}}</th>
                                          <td>{{task["cpus"]}}</td>
                                          <td>{{task["memory"]}}</td>
                                          <td>{{task["disk"]}}</td>
                                          <td>{{task["duration"]}}</td> <!-- convert to seconds or other format -->
                                      </tr>
                                      </tbody>
                                  </table>
                              </div>



                          </div>
                      </div>
                  </div>
              </div>
          </div>
          <hr>
          <h5 class="card-title">Trace Information</h5>
              <table class="table table-hover">
                  <thead>
                  <tr>
                      <th scope="col">Task-ID</th>
                      <th scope="col">Name</th>
                      <th scope="col">Status</th>
                      <th scope="col">Process</th>
                      <th scope="col">Tag</th>
                      <th scope="col">Timestamp</th>
                  </tr>
                  </thead>
                  <tbody>
                    <tr v-for="trace in workflowState.run_traces">
                        <th scope="row">{{trace.task_id}}</th>
                        <td>{{trace.name}}</td>
                        <td>{{trace.status}}</td>
                        <td>{{trace.process}}</td>
                        <td>{{trace.tag}}</td>
                        <td>{{trace.timestamp}}</td>
                    </tr>
                  </tbody>
              </table>
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
