<script setup lang="ts">

import { onMounted, reactive, watch, toRaw} from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js"
import Message from 'primevue/message';
import Fieldset from "primevue/fieldset";
import MultiSelect from "primevue/multiselect";
import Button from "primevue/button";
import ToggleButton from 'primevue/togglebutton';


let {token, runName} : any = defineProps(['token', 'runName'])

const componentState = reactive<{
  availableProcesses: string[];
  availableTags: string[];
  autoselectAllRunningProcesses: boolean;
  autoselectAllRunningTags: boolean;
  selectedRunningTags: any[];
  selectedRunningProcesses: any[];
  filteredProcesses: any[];
}>({

  availableProcesses: [],
  availableTags: [],
  autoselectAllRunningProcesses: true,
  autoselectAllRunningTags: true,
  selectedRunningTags: [],
  selectedRunningProcesses: [],
  filteredProcesses: [],

});



function runningProcessSelectionChanged(): void {
  // TODO: refactor - on filter adjustment send a new request to API to get running processes
  let filtered: any = {};
  
  let tagFilter: boolean = false;
  let selectedTags: any = null;
  if (componentState.selectedRunningTags.length > 0 && componentState.selectedRunningTags.length !== componentState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(componentState.selectedRunningTags);
  }
  
}

function runningTagSelectionChanged(): void {

}

function unselectAllRunningProcesses(): void {

}

function selectAllRunningProcesses(): void {

}

function hideAutoUpdateEnableOptionRunning(): boolean {
  return false;

  // refactor
}

function runningProcessAutoSelectionChanged(): void {

}

function unselectAllRunningTags(): void {

}

function selectAllRunningTags(): void {

}

function hideAutoUpdateEnableOptionRunningTags(): boolean {
  return false;

  // refactor
}

function runningTagAutoSelectionChanged(): void {

}

onMounted(() => {
  console.log("IM HERE")
});

</script>

<template>
   <Fieldset legend="Currently Running" :toggleable="true">

<div class="card-body my-4">
  <Message closable >This area displays the tasks, grouped by process, that are currently running and correspond to the settings of the following filter</Message>
<div class="row my-3">
  <div class="col-6">
    <MultiSelect v-model="componentState.selectedRunningProcesses" :options="componentState.availableProcesses"
      v-on:change="runningProcessSelectionChanged();" :showToggleAll=false filter placeholder="Select Processes"
      display="chip" class="md:w-20rem" style="max-width: 40vw" optionLabel="name"
      :disabled="componentState.autoselectAllRunningProcesses">
    </MultiSelect>
  </div>
  <div class="col-3">
    <Button :disabled="componentState.autoselectAllRunningProcesses" v-on:click="unselectAllRunningProcesses()"
      label="Deselect all" />
    <Button :disabled="componentState.autoselectAllRunningProcesses" v-on:click="selectAllRunningProcesses()"
      label="Select all" />
  </div>
  <div class="col-3">
    <ToggleButton id="metricSelectButton" v-model="componentState.autoselectAllRunningProcesses"
      onLabel="Autoupdate enabled" offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionRunning()"
      onIcon="pi pi-check" offIcon="pi pi-times" v-on:change="runningProcessAutoSelectionChanged()" />
  </div>
</div>
<div class="row my-3">
  <div class="col-6">
    <MultiSelect v-model="componentState.selectedRunningTags" :options="componentState.availableTags"
      v-on:change="runningTagSelectionChanged();" :showToggleAll=false filter placeholder="Select Tag" display="chip"
      class="md:w-20rem" style="max-width: 40vw" optionLabel="name" :disabled="componentState.autoselectAllRunningTags">
      <template #chip="selectedTag">
        <div class="flex align-items-center">
          <div v-if="Object.keys(selectedTag.value)[0] !== ''">{{ Object.keys(selectedTag.value)[0] }} : {{
            Object.values(selectedTag.value)[0] }}</div>
          <div v-if="Object.keys(selectedTag.value)[0] === ''">Empty tag</div>
        </div>
      </template>
      <template #option="slotProps">
        <div class="flex align-items-center">
          <div v-if="Object.keys(slotProps.option)[0] !== ''">
            {{ Object.keys(slotProps.option)[0] }}: {{ Object.values(slotProps.option)[0] }}
          </div>
          <div v-if="Object.keys(slotProps.option)[0] === ''">Empty tag</div>
        </div>
      </template>
    </MultiSelect>
  </div>
  <div class="col-3">
    <Button :disabled="componentState.autoselectAllRunningTags" v-on:click="unselectAllRunningTags()"
      label="Deselect all" />
    <Button :disabled="componentState.autoselectAllRunningTags" v-on:click="selectAllRunningTags()" label="Select all" />
  </div>
  <div class="col-3">
    <ToggleButton id="metricSelectButton" v-model="componentState.autoselectAllRunningTags" onLabel="Autoupdate enabled"
      offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionRunningTags()" onIcon="pi pi-check"
      offIcon="pi pi-times" v-on:change="runningTagAutoSelectionChanged()" />
  </div>
</div>


</div>

<div v-for="(info, process) in componentState.filteredProcesses" class="row my-2">
<Panel toggleable :collapsed="true"
:header="`${process}: ${info.length > 1 ? info.length + ' tasks' : ' 1 task'}`">
  <ul class="list-group list-group-flush">
    <li v-for="task of info"
    class="list-group-item"><strong>Task #{{ task['task_id'] }}<span :class="task['attempt'] > 1 ? 'text-danger' : ''"> - attempt {{ task['attempt'] }}</span></strong> <Tag class="m-1" v-for="tag_elem of task['tag']"
      :value="Object.keys(tag_elem)[0] === '' ? 'Empty Tag' : Object.keys(tag_elem)[0] + ': ' + Object.values(tag_elem)[0]"></Tag>
    </li>
  </ul>
</Panel>

</div>
</Fieldset>
</template>

<style scoped>

</style>
