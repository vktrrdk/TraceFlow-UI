<script setup lang="ts">
import {onMounted, reactive, watch} from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js"
import ProgressBar from 'primevue/progressbar';
import Knob from 'primevue/knob';
import { defineProps } from "vue";


const {progress} : any = defineProps(['progress'])

</script>

<template>
   <h3 class="card-title">Progress</h3>
      <hr>
      <div v-if="progress">
        <div class="mb-4 p-4">
          <div class="row justify-content-center">
            <ProgressBar v-if="progress['all'] > 0" class="mt-2" :showValue="false"
              style="height: 3px; max-width: 70vw;"
              :value="parseInt((progress['completed'] / progress['all']) * 100)">
            </ProgressBar>
          </div>
          <div class="row justify-content-center">
            {{ progress['completed'] }} of {{ progress['all'] }} processes completed
          </div>

        </div>
        <div class="row p-2">
          <div class="col-2 p-2">
            <Knob v-if="progress['all'] > 0" :min="0" :max="progress['all']"
              v-model="progress['submitted']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Submitted</span>
          </div>
          <div class="col-2 p-2">
            <Knob v-if="progress['all'] > 0" :min="0" :max="progress['all']"
              v-model="progress['pending']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Pending</span>
          </div>
          <div class="col-2 p-2">
            <Knob v-if="progress['all'] > 0" :min="0" :max="progress['all']"
              v-model="progress['running']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Running</span>
          </div>
          <div class="col-2 p-2">
            <Knob v-if="progress['all'] > 0" :min="0" :max="progress['all']"
              v-model="progress['cached']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Cached</span>
          </div>
          <div class="col-2 p-2">
            <Knob v-if="progress['all'] > 0" :min="0" :max="progress['all']"
              valueColor="Green" v-model="progress['completed']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Completed</span>
          </div>
          <div class="col-2 p-2">
            <Knob v-if="progress['all'] > 0" :min="0" :max="progress['all']" valueColor="Red"
              v-model="progress['failed']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Failed</span>
          </div>
        </div>
      </div>
</template>

<style scoped>

</style>
