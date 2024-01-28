import { LightningElement, api, track,wire } from "lwc";
import LeaveDetailObject from "@salesforce/schema/LeaveDetail__c";
import insertNewLeaves from "@salesforce/apex/CalendarController.insertNewLeaves";
import getMemberLeaves from "@salesforce/apex/CalendarController.getMemberLeaves";
import getFixedLeaveRecords from "@salesforce/apex/CalendarController.getFixedHolidayRecords";
import LeaveDate from "@salesforce/schema/LeaveDetail__c.Date__c";
import Name from "@salesforce/schema/LeaveDetail__c.Name";
import { ShowToastEvent } from "lightning/platformShowToastEvent";


// array to store day names
const dayName = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
];


// array to store month names
const monthNamesSet = [
  "January",
  "Febuary",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

//set to store weekends day name
const fixedHolidays = new Set(["Sun", "Sat"]);


export default class DisplayCalendar extends LightningElement {

  @track toast ={}


  selectedDates = new Set();
  deselectedDates = new Set();
  runOnce = false;
  date = new Date();
  @track _userData = {};


  // property to create user leaves data to server
  dataToSend = {
    WorkEmail: "shubhampnd414@gmail.com",
    leavesDetailsList: [],
    leavesDeleteList: []
  };


  // property to track calendar configuration
  @track calendarConfig = {
    selectedMonthInt: this.date.getMonth(),
    selectedMonthFirstDay:undefined,
    selectedMonthTotalDays:undefined,
    isLoading: false,
    unsavedChangesForMonth:false,
    fixedHolidaysTracker : {}
  };


    // method to fetch dates metadata records(fixed holidays)
    fixedLeavesMethod(recordsArr){
    try{
      if(recordsArr != undefined){
            recordsArr.forEach(({Date__c : fixedHoliday})=>{
            const dateFormat = new Date(fixedHoliday);
            const month = dateFormat.getMonth()
            const monthDay = dateFormat.getDate();
            if(this.calendarConfig.fixedHolidaysTracker[month] != undefined){
              this.calendarConfig.fixedHolidaysTracker[month].add(monthDay)
            }
            else{
              this.calendarConfig.fixedHolidaysTracker[month] = new Set().add(monthDay)
            }
          })
        }        
      else{
        console.log('unable to get fixed leaves MD....')
      }
    }
    catch(err){
console.log('mdd',err)
    }
    
  }

  get selectedMonth() {
    return this.calendarConfig.selectedMonthInt
  }

  get dataLoading() {
    return this.calendarConfig.isLoading;
  }

  get disableCalNxtBtn(){
    return (this.calendarConfig.selectedMonthInt == 11)
  }

  get disableCalPrevBtn(){
    return (this.calendarConfig.selectedMonthInt == 0)
  }


  // handler to navigate the months
  handleCalendarNavigation(event){
    try{
    console.log('oo')
    const btnClicked = event.target?.name
    if(btnClicked === 'NextBtn'){  // move calendar to next month
      const clickedEvent = new CustomEvent('click' , {detail : {value : this.calendarConfig.selectedMonthInt+1}})
      this.handleMonthChange(clickedEvent)
    }
    else{  // move calendar to previous month
      const clickedEvent = new CustomEvent('click' , {detail : {value : this.calendarConfig.selectedMonthInt-1}})
      this.handleMonthChange(clickedEvent)
    }
  }
    catch(err){
      console.log({err})
    }
  }
  

  @api get getUserData() {
    //console.log(this._userData.leaves);
    return this._userData;
  }


  //set to set user leaves records for calendar
  set getUserData(dataObj) {
    try {
      console.log("setter user dat", dataObj.leaves);
      if (dataObj?.leaves != undefined) {
        this._userData.confirmedLeaves = {};
        dataObj.leaves.forEach(({ leaveId, leaveDate }) => {
          const dateFormat = new Date(leaveDate);
          const month = dateFormat.getMonth();
          const monthDay = dateFormat.getDate();
          console.log({ monthDay });

          if (!this._userData.confirmedLeaves[month]) {
            console.log("no add");
            this._userData.confirmedLeaves[month] = [
              { Id: leaveId, date: monthDay }
            ];
          } else {
            console.log("add", this._userData.confirmedLeaves);
            this._userData.confirmedLeaves[month].push({
              Id: leaveId,
              date: monthDay
            });
          }
        });

        const { selectedMonthFirstDay:startDateDayInt, selectedMonthTotalDays:totalDays } = this.calendarConfig
        this.handleCalanderMonthDates(
          startDateDayInt,
          Math.floor(totalDays / 6),
          totalDays
        );
      }
      console.log(this._userData.confirmedLeaves);
    } catch (err) {
      console.log({ err });
    } finally {
      this.calendarConfig.isLoading = false;

    }
  }


  // getter to create array of object for dropdown
  get monthNamesList() {
    return monthNamesSet.map((currentMonth, index) => {
      return {
        label: currentMonth,
        value: index
      };
    });
  }


  get showModal(){
    return true
  }

  // connected to set calendar table(header) and fetch user data/ metadata
  async connectedCallback() {
    try { 
      console.log("Calendar CB");
      this.toast.toastVariant = 'success'
      const date1 = new Date(2023, 0, 8);
      const date2 = new Date(2024, 0, 5);

      const date3 = new Date(2023, 11, 20);

      const dates = [
        { leaveId: "qwert", leaveDate: date1 },
        { leaveId: "fhh", leaveDate: date2 },
        { leaveId: "cc", leaveDate: date3 }
      ];
      this.calendarConfig.isLoading = true;
      const requestResolved = await Promise.all([getFixedLeaveRecords(),getMemberLeaves({memberId: "0035g00000TvMwGAAV"} )])
      let responseObjArr =[]
      if(requestResolved != undefined){
        requestResolved?.forEach((response)=>{
        responseObjArr.push(JSON.parse(response))
        })

      console.log(responseObjArr)
      if(responseObjArr.length != 0){
        this.fixedLeavesMethod(responseObjArr[0])
        this.getUserData = { leaves : responseObjArr[1]}
      }
      }
    } catch (err) {
      console.log('not res',err)
    }

    finally{
      this.calendarConfig.isLoading  = false
    }
  }

  // method to display  date in table cells
  handleCalanderMonthDates(monthStartDate, totalRows, totalDays) { 
    console.log('dates are being set...');
    const table = this.template.querySelector(".calendar_table");
    const calendarDateRows =
      this.template.querySelectorAll(".calendar-date_row");
    const calendarDateCell = this.template.querySelectorAll(
      ".calendar-data_cell"
    );
    if (calendarDateCell.length !== 0) {
      calendarDateCell.forEach((td) => {
        td.textContent = "";
        td.setAttribute("data-fullDate", "");
        td.removeAttribute("data-recordId")
        td.classList.remove(
          "valid-date",
          "selected-date",
          "confirmed-date",
          "cancelled-date",
          "inactive-date"
        );
      });
    }
    
    let fixedHolidayMD = []
    if(this.calendarConfig.fixedHolidaysTracker[this.calendarConfig.selectedMonthInt+''] !=undefined){
      fixedHolidayMD = [...this.calendarConfig.fixedHolidaysTracker[this.calendarConfig.selectedMonthInt]]
    }
    console.log({fixedHolidayMD})
    const firstDay = monthStartDate;
    let start = 1;
    let cellCounter = 0;
    for (let i = 0; i <= totalRows; i++) {
      const dateRow = calendarDateRows[i] || document.createElement("tr");
      dateRow.classList.add("calendar-date_row");
      for (let col = 0; col < 7; col++) {
        const td =
          calendarDateCell[monthStartDate] || document.createElement("td");
        td.classList.add("calendar-data_cell");
        if ((i === 0 && col >= firstDay) || (i !== 0 && start <= totalDays)) {
          console.log(start == 22,fixedHolidayMD.includes(start))
          if(fixedHolidayMD.includes(start)){
            console.log('gggg')
          }
          if (fixedHolidayMD.indexOf(start) != -1 || fixedHolidays.has(dayName[col] )) {  //fixed holidays
            console.log('holid', start)
            //td.textContent = `${start} - Holiday`;
              td.textContent = start
              td.classList.add("inactive-date");
          }
           else {  // valid working days
            console.log('valid d', start)
            let dateObj = new Date(
              new Date().getFullYear(),
              this.calendarConfig.selectedMonthInt,
              start)
            td.textContent = start;
            td.classList.add("valid-date");
            td.setAttribute("data-fullDate", dateObj);
            if (
              this._userData?.confirmedLeaves?.[
                this.calendarConfig.selectedMonthInt
              ]
            ) {
              const confirmedDatesSet = new Set();
              this._userData.confirmedLeaves[
                this.calendarConfig.selectedMonthInt
              ].forEach(({ Id, date }) => {
                if (date === td.textContent * 1) {
                  td.classList.add("confirmed-date", "selected-date");
                  td.setAttribute("data-recordId", Id);
                }
                  this.selectedDates.delete(date);
                  this.deselectedDates.delete(date);
              });


            }

          }
          start++;
          monthStartDate++;
        }
        if (calendarDateRows.length === 0) {
          dateRow.appendChild(td);
        }
      }

      if (calendarDateRows.length === 0) {
        table.appendChild(dateRow);
      }
    }
  }


  // method to handle calendar header(day name & table)
  createCalendarHeader(){
    const wrapper = this.template.querySelector(".calendar_wrapper");
    console.log(wrapper);
    const table = document.createElement("table");
    table.classList.add("calendar_table");
    const headerRow = document.createElement("tr");

    for (let day of dayName) {
      const header = document.createElement("th");
      header.textContent = day;
      header.classList.add("calendar-month_name");
      headerRow.appendChild(header);
    }

    wrapper.appendChild(table);
    table.appendChild(headerRow);
  }


  renderedCallback() {
    console.log("rc");
    if (!this.runOnce) {
      this.runOnce = true;
      this.createCalendarHeader();  // set table with header
      this.calculateCurrentDate(0);

    }
  }

  // method to calculate no. of days in a month
  daysInMonth(year, month) { 
    console.log(year, month);
    return new Date(year, month, 0).getDate();
  }

   // method to get month metadata
  calculateCurrentDate(selectedMonth) {
    const currentYear = new Date().getFullYear();
    const currentMonth = selectedMonth || this.calendarConfig.selectedMonthInt;
    console.log(currentMonth, currentYear);
    const totalDays = this.daysInMonth(currentYear, currentMonth + 1);
    console.log(totalDays);
    let dayWithDate = {};
    for (let i = 1; i <= totalDays; i++) {
      const currentDate = new Date(currentYear, currentMonth, i);
      const day = dayName[currentDate.getDay()];
      const date = currentDate.getDate();
      if (!dayWithDate[day]) {
        dayWithDate[day] = [date];
      } else {
        dayWithDate[day].push(date);
      }
      if (date === 1) {
        dayWithDate.startDateDayInt = currentDate.getDay();
        this.calendarConfig.selectedMonthFirstDay = currentDate.getDay();
      }
    }
    this.calendarConfig.selectedMonthTotalDays = totalDays
    dayWithDate.totalDays = totalDays;
    console.log(dayWithDate);
    return dayWithDate;
  }


  // method to handle month change(btn)
   handleMonthChange(event) {
    this.selectedDates.clear(); // clear all the selected dates for the selected month when save is clicked
    this.deselectedDates.clear();
    const selectedMonth = event.detail?.value;
    console.log({ selectedMonth });
    if (selectedMonth != undefined) {
      this.calendarConfig.selectedMonthInt = selectedMonth * 1;
      const getCurrentDatesObj = this.calculateCurrentDate(
        this.calendarConfig.selectedMonthInt
      );
     const { startDateDayInt, totalDays } = getCurrentDatesObj;
      //const {  selectedMonthFirstDay:  startDateDayInt, selectedMonthTotalDays: totalDays } = this.calendarConfig
      this.handleCalanderMonthDates(
        startDateDayInt,
        Math.floor(totalDays / 6),
        totalDays
      );
    }
    
  }

  // method to handle data change (toggle date cell)
  handleDateChange(event) { 
    const clickedDate = event.target;
    const date = clickedDate.textContent * 1;
    const recordId = clickedDate.dataset.recordid;

    if (clickedDate.classList.contains("valid-date")) {
      clickedDate.classList.toggle("selected-date");
      if (this.selectedDates.has(date)) {
        this.selectedDates.delete(date);
      }
      if (!clickedDate.classList.contains("selected-date")) {
        console.log("removed");
        if (recordId != undefined) {
          this.deselectedDates.add(recordId);
        }
        clickedDate.classList.remove("confirmed-date"); // confirmed leave cancelled
        clickedDate.classList.add("cancelled-date");
      }
      if (clickedDate.classList.contains("selected-date")) {
        this.selectedDates.add(date);
        clickedDate.classList.remove("cancelled-date"); // confirmed leave cancelled
      }
      if (
        clickedDate.classList.contains("selected-date") &&
        recordId != undefined
      ) {
        clickedDate.classList.add("confirmed-date"); // confirmed leave
        this.deselectedDates.delete(recordId);
        this.selectedDates.delete(date); // date is already been saved into Database
      }
    }
    console.log(this.selectedDates, this.deselectedDates);
  }


 // method to handle save operation(date insertion/deletion)
  async saveSelectedDates(event) { 
    try {
      const modalCmp = this.template.querySelector('c-modal-cmp')
      console.log('modal',modalCmp)
      if (this.selectedDates.size || this.deselectedDates.size) {
        // user has selected dates for the current month
        console.log(this.selectedDates);
        const datesToInsert = [...this.selectedDates].map((date) => {
          const createDate = new Date();
          createDate.setMonth(this.calendarConfig.selectedMonthInt);
          createDate.setDate(date);
          const leaveRecord = {};
          leaveRecord.leaveDate = createDate;
          leaveRecord.leaveType = "Casual Leave";
          return leaveRecord;
        });
        if (datesToInsert.length != 0) {
          this.dataToSend.leavesDetailsList = datesToInsert;
        }

        const dataToDelete = [...this.deselectedDates].map((dateId) => {
          const leaveRecord = {};
          leaveRecord.leaveId = dateId;
          return leaveRecord;
        });
        if (dataToDelete.length != 0) {
          this.dataToSend.leavesDeleteList = dataToDelete;
        }
        console.log(dataToDelete);

        console.log("final data to send", this.dataToSend);
        const jsonData = JSON.stringify(this.dataToSend);
        console.log(jsonData);
        const responseObj = await insertNewLeaves({ jsonResponse: jsonData });
        console.log(responseObj);
        if (responseObj) {
          this.calendarConfig.isLoading = true;
          this.selectedDates = new Set();
          this.deselectedDates = new Set();
          this.dataToSend = {};
          console.log("data is reset", this.selectedDates);
          const jsonResponse = await getMemberLeaves({
            memberId: "0035g00000TvMwGAAV"
          });
          console.log({ jsonResponse });
          if (jsonResponse) {
            const memberLeaves = JSON.parse(jsonResponse);
            this.getUserData = { leaves: memberLeaves };
            this.showToastMessage('Changes are saved.', 'success')
            this.toast.toastMessage = 'Changes are saved.'
            this.toast.toastVariant = 'success'
            this.toast.isActive = true
          }
        } else {
          //show error on UI  : dates are not inserted/deleted
          console.log('not inse/del')
          this.toast.toastMessage = 'Changes not saved.Please try again.'
          this.toast.toastVariant = 'error'
          modalCmp.showToast()

        }
      }

      else if(!this.selectedDates.size && !this.deselectedDates.size){
        console.log('no hange')
       // this.showToastMessage('No changes to save.' , 'warning')
        this.toast.toastMessage = 'No Changes to save.'
        this.toast.toastVariant = 'warning'
        modalCmp.showToast()
      }
    } catch (err) {
      console.log({ err });
      const modalCmp = this.template.querySelector('c-modal-cmp')
      this.toast.toastMessage = 'Changes not saved.Please try again.'
      this.toast.toastVariant = 'error'
      modalCmp.showToast()
    } finally {
     
    }
  }



  // method to clean dates :selection/cancel
  async cancelDateSelection(event){                         // method to clean dates(cancel btn)
    const calendarDateCell = this.template.querySelectorAll(
      ".calendar-data_cell"
    );
    if(calendarDateCell != undefined){
      calendarDateCell.forEach((date)=>{
        if(this.selectedDates.has(1*date.textContent)){
          date.classList.remove(
            "selected-date",
            "confirmed-date",
            "cancelled-date"
          );
        }
      })

      this.selectedDates= new Set()    // cmp properties are reset
      this.deselectedDates= new Set()
    }

  }


  // method to check unsaved changes on the current month
  async checkUnsavedChanges(){
    console.log('checking unsav ch..')
    if(this.selectedDates.size || this.deselectedDates.size){
        const result = await LightningConfirm.open({
            message: 'You have unsaved changes. Do you want to continue or cancel?',
            variant: 'headerless',
            label: 'this is the aria-label value',
            theme : 'warning'
        })
      return result

    }
  }

  showToastMessage(message, type = "success") {
    this.dispatchEvent(
      new ShowToastEvent({
        title : '.',
        message: message,
        variant: type
      })
    );
  }
}
