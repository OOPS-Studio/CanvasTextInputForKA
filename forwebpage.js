var TextInput;

if(typeof TextInput === "undefined"){
    TextInput = class{
        static mouseX = 0;
        static mouseY = 0;
        static mouseClicked = false;
        static mousePressed = false;
        static mouseMoved = false;
        static holdingShift = false;
        static holdingControl = false;
        static requestingHover = false;
        static frameCounter = 0;
        static nextFrame(){
            TextInput.requestingHover = false;
            TextInput.mouseClicked = false;
            TextInput.mouseMoved = false;
            TextInput.frameCounter++;
        }
        static IGNORE_LIST = ["Control","Alt","Shift","Enter","Escape","CapsLock","Meta","PageUp","PageDown","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","Home","End","Insert","Tab"];
        static restrain(val,min,max){
            return(val < min ? min : (val > max ? max : val));
        }
        static roundedRect(ctx,x,y,w,h,r1,r2,r3,r4){
            if(typeof r2 === "undefined"){
                r2 = r1;
                r3 = r1;
                r4 = r1;
            }
            if(h < w){
                r1 = TextInput.restrain(r1,0,h / 2);
                r2 = TextInput.restrain(r2,0,h / 2);
                r3 = TextInput.restrain(r3,0,h / 2);
                r4 = TextInput.restrain(r4,0,h / 2);
            }else{
                r1 = TextInput.restrain(r1,0,w / 2);
                r2 = TextInput.restrain(r2,0,w / 2);
                r3 = TextInput.restrain(r3,0,w / 2);
                r4 = TextInput.restrain(r4,0,w / 2);
            }
            ctx.beginPath();
            ctx.moveTo(x + r1,y);
            ctx.lineTo(x + w - r2,y);
            ctx.arcTo(x + w,y,x + w,y + r2,r2);
            ctx.lineTo(x + w,y + h - r3);
            ctx.arcTo(x + w,y + h,x + w - r3,y + h,r3);
            ctx.lineTo(x + r4,y + h);
            ctx.arcTo(x,y + h,x,y + h - r4,r4);
            ctx.lineTo(x,y + r1);
            ctx.arcTo(x,y,x + r1,y,r1);
            ctx.closePath();
        }
        constructor(canvas,x,y,style = {}){
            this.ctx = canvas.getContext("2d");

            this.x = x;
            this.y = y;
            this.width = 150;
            this.height = 0;
            this.textSize = 15;
            
            this.mouseX = 0;
            this.mouseY = 0;
            
            this.selected = false;
            this.value = "";
            this.blinkCounter = 0;
            this.insertingAt = 0;
            this.highlighting = false;
            this.arrowKeyHighlightingOrigin = false;
            this.undos = [];
            this.undoIndex = 0;
            this.undoneValue = false;

            this.scroll = 0;
            this.alignScroll = undefined;

            this.placeholder = "";
            this.highlightAllTextWhenSelected = false;

            this.style = {
                backgroundColor: "white",
                textColor: "black",
                borderColor: "black",
                borderWidth: 2,
                borderRadius: 0,
                placeholderColor: "rgba(0,0,0,0.65)",
                highlightColor: "rgb(60,100,255)",
                paddingLeft: 0,
                paddingRight: 0,
                paddingTop: 0,
                paddingBottom: 0,
                highlightedTextColor: "white",
                onSelect: {
                    backgroundColor: false,
                    textColor: false,
                    borderColor: "rgb(0,150,255)",
                    borderWidth: 2.5,
                    borderRadius: false,
                    paddingLeft: false,
                    paddingRight: false,
                    paddingTop: false,
                    paddingBottom: false
                }
            };

            this.setStyle(style);

            document.addEventListener("keydown",e => {
                if(e.key === "Shift"){
                    TextInput.holdingShift = true;
                }
                if(e.key === "Control"){
                    TextInput.holdingControl = true;
                }
                if(this.processingPaste || this.lastRendered < TextInput.frameCounter - 1){
                    return;
                }
                this.handleKeypress(e.key);
                if(this.selected){
                    this.onkeypress(e.key);
                }
            });
            document.addEventListener("keyup",e => {
                if(e.key === "Shift"){
                    TextInput.holdingShift = false;
                }
                if(e.key === "Control"){
                    TextInput.holdingControl = false;
                }
                if(this.selected && this.lastRendered < TextInput.frameCounter - 1){
                    this.onkeyrelease(e.key);
                }
            });
            document.addEventListener("mousedown",e => {
                TextInput.mouseClicked = true;
                TextInput.mousePressed = true;
            });
            document.addEventListener("mouseup",e => {
                TextInput.mousePressed = false;
            });
            document.addEventListener("mousemove",e => {
                TextInput.mouseMoved = true;
            });
            
            document.addEventListener("mousemove",e => {
                let rect = canvas.getBoundingClientRect();
                this.mouseX = Math.round(e.clientX - rect.left)
                this.mouseY = Math.round(e.clientY - rect.top);
            });
        }
        setValue(newValue){
            if(this.undoIndex < this.undos.length){
                this.undos = [];
                this.undoIndex = 0;
                this.undoneValue = false;
            }
            this.undoIndex++;
            this.undos.push({value: this.value,insertingAt: this.highlighting ? this.highlighting : this.insertingAt});
            if(this.undos.length > 100){
                this.undos.shift();
                this.undoIndex--;
            }
            this.value = newValue;
        }
        undo(){
            if(this.undoIndex === 0){
                return;
            }
            this.undoIndex--;
            if(!this.undoneValue){
                this.undoneValue = {value: this.value,insertingAt: this.highlighting ? this.highlighting : this.insertingAt};
            }
            this.value = this.undos[this.undoIndex].value;
            if(typeof this.undos[this.undoIndex].insertingAt === "number"){
                this.insertingAt = this.undos[this.undoIndex].insertingAt;
            }else{
                this.insertingAt = this.undos[this.undoIndex].insertingAt[1];
            }
            this.blinkCounter = 0;
            this.highlighting = false;
        }
        redo(){
            if(this.undoIndex >= this.undos.length){
                return;
            }
            this.undoIndex++;
            if(this.undoIndex < this.undos.length){
                this.value = this.undos[this.undoIndex].value;
                if(typeof this.undos[this.undoIndex].insertingAt === "number"){
                    this.insertingAt = this.undos[this.undoIndex].insertingAt;
                }else{
                    this.insertingAt = this.undos[this.undoIndex].insertingAt[0];
                }
            }else{
                this.value = this.undoneValue.value;
                if(typeof this.undoneValue.insertingAt === "number"){
                    this.insertingAt = this.undoneValue.insertingAt;
                }else{
                    this.insertingAt = this.undoneValue.insertingAt[0];
                }
            }
            this.blinkCounter = 0;
        }
        handleKeypress(key){
            if(this.selected && !TextInput.mousePressed){
                if(key === "Backspace"){
                    this.blinkCounter = 0;
                    if(!this.highlighting){
                        if(this.insertingAt > 0){
                            this.setValue(this.value.substring(0,this.insertingAt - 1) + this.value.substring(this.insertingAt,this.value.length));
                            this.insertingAt--;
                        }
                    }else{
                        this.insertingAt = this.highlighting[0];
                        this.setValue(this.value.substring(0,this.highlighting[0]) + this.value.substring(this.highlighting[1],this.value.length));
                        this.highlighting = false;
                    }
                }else if(key === "Delete"){
                    this.blinkCounter = 0;
                    if(!this.highlighting){
                        if(this.insertingAt < this.value.length){
                            this.setValue(this.value.substring(0,this.insertingAt) + this.value.substring(this.insertingAt + 1,this.value.length));
                        }
                    }else{
                        this.insertingAt = this.highlighting[0];
                        this.setValue(this.value.substring(0,this.highlighting[0]) + this.value.substring(this.highlighting[1],this.value.length));
                        this.highlighting = false;
                    }
                }else if(key === "Enter"){
                    this.onenter();
                }else if(key === "ArrowLeft"){
                    if(this.highlighting){
                        if(TextInput.holdingShift){
                            if(this.arrowKeyHighlightingOrigin[1] > 0){
                                this.arrowKeyHighlightingOrigin[1]--;
                            }
                        }else{
                            this.insertingAt = this.highlighting[0];
                            this.highlighting = false;
                        }
                    }else if(TextInput.holdingShift && this.insertingAt > 0){
                        this.highlighting = [this.insertingAt - 1,this.insertingAt];
                        this.arrowKeyHighlightingOrigin = [this.insertingAt,this.insertingAt - 1];
                    }else if(this.insertingAt > 0){
                        this.insertingAt--;
                    }
                    if(this.highlighting){
                        if(this.arrowKeyHighlightingOrigin[1] < this.arrowKeyHighlightingOrigin[0]){
                            this.highlighting = [this.arrowKeyHighlightingOrigin[1],this.arrowKeyHighlightingOrigin[0]];
                        }else{
                            this.highlighting = [this.arrowKeyHighlightingOrigin[0],this.arrowKeyHighlightingOrigin[1]];
                        }
                    }
                    this.blinkCounter = 0;
                }else if(key === "ArrowRight"){
                    if(this.highlighting){
                        if(TextInput.holdingShift){
                            if(this.arrowKeyHighlightingOrigin[1] < this.value.length){
                                this.arrowKeyHighlightingOrigin[1]++;
                            }
                        }else{
                            this.insertingAt = this.highlighting[1];
                            this.highlighting = false;
                        }
                    }else if(TextInput.holdingShift && this.insertingAt < this.value.length){
                        this.highlighting = [this.insertingAt,this.insertingAt + 1];
                        this.arrowKeyHighlightingOrigin = [this.insertingAt,this.insertingAt + 1];
                    }else if(this.insertingAt < this.value.length){
                        this.insertingAt++;
                    }
                    if(this.highlighting){
                        if(this.arrowKeyHighlightingOrigin[1] < this.arrowKeyHighlightingOrigin[0]){
                            this.highlighting = [this.arrowKeyHighlightingOrigin[1],this.arrowKeyHighlightingOrigin[0]];
                        }else{
                            this.highlighting = [this.arrowKeyHighlightingOrigin[0],this.arrowKeyHighlightingOrigin[1]];
                        }
                    }
                    this.blinkCounter = 0;
                }else if(key === "ArrowUp"){
                    if(this.highlighting){
                        if(TextInput.holdingShift){
                            this.arrowKeyHighlightingOrigin[1] = 0;
                        }else{
                            this.insertingAt = 0;
                            this.highlighting = false;
                        }
                    }else if(TextInput.holdingShift){
                        this.highlighting = [0,this.insertingAt];
                        this.arrowKeyHighlightingOrigin = [this.insertingAt,0];
                    }else{
                        this.insertingAt = 0;
                    }
                    if(this.highlighting){
                        if(this.arrowKeyHighlightingOrigin[1] < this.arrowKeyHighlightingOrigin[0]){
                            this.highlighting = [this.arrowKeyHighlightingOrigin[1],this.arrowKeyHighlightingOrigin[0]];
                        }else{
                            this.highlighting = [this.arrowKeyHighlightingOrigin[0],this.arrowKeyHighlightingOrigin[1]];
                        }
                    }
                    this.blinkCounter = 0;
                }else if(key === "ArrowDown"){
                    if(this.highlighting){
                        if(TextInput.holdingShift){
                            this.arrowKeyHighlightingOrigin[1] = this.value.length;
                        }else{
                            this.insertingAt = this.value.length;
                            this.highlighting = false;
                        }
                    }else if(TextInput.holdingShift){
                        this.highlighting = [this.insertingAt,this.value.length];
                        this.arrowKeyHighlightingOrigin = [this.insertingAt,this.value.length];
                    }else{
                        this.insertingAt = this.value.length;
                    }
                    if(this.highlighting){
                        if(this.arrowKeyHighlightingOrigin[1] < this.arrowKeyHighlightingOrigin[0]){
                            this.highlighting = [this.arrowKeyHighlightingOrigin[1],this.arrowKeyHighlightingOrigin[0]];
                        }else{
                            this.highlighting = [this.arrowKeyHighlightingOrigin[0],this.arrowKeyHighlightingOrigin[1]];
                        }
                    }
                    this.blinkCounter = 0;
                }else if(TextInput.IGNORE_LIST.indexOf(key) === -1){
                    if(TextInput.holdingControl){
                        if(key === "a"){
                            this.highlighting = [0,this.value.length];
                            this.arrowKeyHighlightingOrigin = [0,this.value.length];
                        }else if(key === "c" && this.highlighting){
                            alert("Khan Academy blocks access to Clipboard. Cutting text is only available off of KA.\nPlease visit https://cutt.ly/FbYS8Gd for a full page of information about why and how KA blocks the use of Clipboard.");
                            this.oncopy();
                        }else if(key === "x" && this.highlighting){
                            alert("Khan Academy blocks access to Clipboard. Cutting text is only available off of KA.\nPlease visit https://cutt.ly/FbYS8Gd for a full page of information about why and how KA blocks the use of Clipboard.");
                            this.oncopy();
                        }else if(key === "v"){
                            alert("Khan Academy blocks access to Clipboard. Cutting text is only available off of KA.\nPlease visit https://cutt.ly/FbYS8Gd for a full page of information about why and how KA blocks the use of Clipboard.");
                            this.onpaste();
                        }else if(key === "z"){
                            this.undo();
                        }else if(key === "y"){
                            this.redo();
                        }
                        return;
                    }
                    var toSet = this.value;
                    if(this.highlighting){
                        this.insertingAt = this.highlighting[0];
                        toSet = toSet.substring(0,this.highlighting[0]) + toSet.substring(this.highlighting[1],toSet.length);
                    }
                    toSet = toSet.substring(0,this.insertingAt) + key + toSet.substring(this.insertingAt,toSet.length);
                    this.insertingAt++;
                    this.setValue(toSet);
                    this.blinkCounter = 0;
                    this.highlighting = false;
                }
            }
        }
        solveSelectedStyle(style){
            return(this.style.onSelect[style] === false ? this.style[style] : this.style.onSelect[style]);
        }
        render(){
            if(this.lastRendered < TextInput.frameCounter - 1){
                this.selected = false;
            }
            this.lastRendered = TextInput.frameCounter;
            
            this.height = this.textSize * 1.1;

            this.ctx.save();
            this.ctx.font = this.textSize + "px sans-serif";
            if(!this.highlighting){
                var insertingX = this.ctx.measureText(this.value.substring(0,this.insertingAt)).width;
                var fullTextWidth = this.ctx.measureText(this.value).width;
                var rightEdge = this.width - this.textSize * 0.1;
                if(fullTextWidth < rightEdge + this.scroll){
                    this.scroll = fullTextWidth - rightEdge > 0 ? fullTextWidth - rightEdge : 0;
                }else if(insertingX < this.scroll){
                    this.scroll = insertingX;
                }else if(insertingX > rightEdge + this.scroll){
                    this.scroll = insertingX - rightEdge;
                }
            }else{
                if(TextInput.mousePressed){
                    var insertingX = this.ctx.measureText(this.value.substring(0,this.highlighting[1])).width;
                    if(this.mouseX < this.x + this.width / 2){
                        if(insertingX < this.scroll){
                            this.scroll = insertingX;
                        }
                    }else{
                        var rightEdge = this.width - this.textSize * 0.1;
                        if(insertingX > rightEdge + this.scroll){
                            this.scroll = insertingX - rightEdge;
                        }
                    }
                }else if(this.arrowKeyHighlightingOrigin){
                    var insertingX = this.ctx.measureText(this.value.substring(0,this.arrowKeyHighlightingOrigin[1])).width;
                    if(insertingX < this.scroll){
                        this.scroll = insertingX;
                    }
                    var rightEdge = this.width - this.textSize * 0.1;
                    if(insertingX > rightEdge + this.scroll){
                        this.scroll = insertingX - rightEdge;
                    }
                }
            }
            this.ctx.beginPath();
            if(!this.selected){
                this.ctx.fillStyle = this.style.backgroundColor;
                this.ctx.lineWidth = this.style.borderWidth;
                this.ctx.strokeStyle = this.style.borderColor;
            }else{
                this.ctx.fillStyle = this.solveSelectedStyle("backgroundColor");
                this.ctx.lineWidth = this.solveSelectedStyle("borderWidth");
                this.ctx.strokeStyle = this.solveSelectedStyle("borderColor");
            }
            if(this.selected){
                TextInput.roundedRect(this.ctx,this.x - this.solveSelectedStyle("paddingLeft"),this.y - this.solveSelectedStyle("paddingTop"),this.width + this.solveSelectedStyle("paddingLeft") + this.solveSelectedStyle("paddingRight"),this.height + this.solveSelectedStyle("paddingTop") + this.solveSelectedStyle("paddingBottom"),this.solveSelectedStyle("borderRadius"));
            }else{
                TextInput.roundedRect(this.ctx,this.x - this.style.paddingLeft,this.y - this.style.paddingTop,this.width + this.style.paddingLeft + this.style.paddingRight,this.height + this.style.paddingTop + this.style.paddingBottom,this.style.borderRadius);
            }
            this.ctx.stroke();
            this.ctx.fill();
            this.ctx.beginPath();
            if(this.selected){
                TextInput.roundedRect(this.ctx,this.x - this.solveSelectedStyle("paddingLeft"),this.y - this.solveSelectedStyle("paddingTop"),this.width + this.solveSelectedStyle("paddingLeft") + this.solveSelectedStyle("paddingRight"),this.height + this.solveSelectedStyle("paddingTop") + this.solveSelectedStyle("paddingBottom"),this.solveSelectedStyle("borderRadius"));
            }else{
                TextInput.roundedRect(this.ctx,this.x - this.style.paddingLeft,this.y - this.style.paddingTop,this.width + this.style.paddingLeft + this.style.paddingRight,this.height + this.style.paddingTop + this.style.paddingBottom,this.style.borderRadius);
            }
            this.ctx.clip();
            if(this.highlighting){
                var dir = true;
                if(this.highlighting[1] < this.highlighting[0]){
                    dir = false;
                }
                this.ctx.fillStyle = this.style.highlightColor;
                if(dir){
                    this.ctx.fillRect(this.x + this.textSize * 0.1 + this.ctx.measureText(this.value.substring(0,this.highlighting[0])).width - this.scroll,this.y,this.ctx.measureText(this.value.substring(this.highlighting[0],this.highlighting[1])).width,this.height);
                }else{
                    this.ctx.fillRect(this.x + this.textSize * 0.1 + this.ctx.measureText(this.value.substring(0,this.highlighting[0])).width - this.scroll,this.y,-this.ctx.measureText(this.value.substring(this.highlighting[0],this.highlighting[1])).width,this.height);
                }
            }
            if(this.value === ""){
                this.ctx.fillStyle = this.style.placeholderColor;
                this.ctx.fillText(this.placeholder,this.x + this.textSize * 0.1,this.y + this.height * 0.79);
            }else{
                if(this.selected){
                    this.ctx.fillStyle = this.solveSelectedStyle("textColor");
                }else{
                    this.ctx.fillStyle = this.style.textColor;
                }
                if(this.highlighting){
                    var p1 = this.highlighting[0] < this.highlighting[1] ? this.highlighting[0] : this.highlighting[1];
                    var p2 = this.highlighting[0] < this.highlighting[1] ? this.highlighting[1] : this.highlighting[0];
                    var textChunks = [this.value.substring(0,p1),this.value.substring(p1,p2),this.value.substring(p2,this.value.length)];
                    var highlightingX = this.ctx.measureText(textChunks[0]).width;
                    this.ctx.fillText(textChunks[0],this.x + this.textSize * 0.1 - this.scroll,this.y + this.height * 0.79);
                    this.ctx.fillText(textChunks[2],this.x + this.textSize * 0.1 + highlightingX + this.ctx.measureText(textChunks[1]).width - this.scroll,this.y + this.height * 0.79);
                    this.ctx.fillStyle = this.style.highlightedTextColor;
                    this.ctx.fillText(textChunks[1],this.x + this.textSize * 0.1 + highlightingX - this.scroll,this.y + this.height * 0.79);
                }else{
                    this.ctx.fillText(this.value,this.x + this.textSize * 0.1 - this.scroll,this.y + this.height * 0.79);
                }
            }
            if(this.selected && !this.highlighting){
                this.blinkCounter++;
                if(this.blinkCounter > 100){
                    this.blinkCounter = 0;
                }
                if(this.blinkCounter < 50){
                    this.ctx.strokeStyle = "black";
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    var w = this.ctx.measureText(this.value.substring(0,this.insertingAt)).width;
                    this.ctx.moveTo(this.x + this.textSize * 0.1 + w - this.scroll,this.y + 1);
                    this.ctx.lineTo(this.x + this.textSize * 0.1 + w - this.scroll,this.y + this.height - 2);
                    this.ctx.stroke();
                }
            }
            this.ctx.restore();

            if(TextInput.mouseClicked){
                this.highlighting = false;
            }
            if(this.isMouseInside()){
                if(TextInput.mouseClicked){
                    this.blinkCounter = 0;

                    if(!this.selected && this.highlightAllTextWhenSelected){
                        this.highlighting = [0,this.value.length];
                        TextInput.mousePressed = false;
                    }else{
                        this.ctx.save();
                        this.ctx.font = this.textSize + "px sans-serif";
                        var w = this.ctx.measureText(this.value).width;
                        var xin = (this.mouseX - this.x - this.textSize * 0.1) + this.scroll;
                        if(xin > w){
                            this.insertingAt = this.value.length;
                        }else if(xin <= this.ctx.measureText(this.value.charAt(0)).width / 2){
                            this.insertingAt = 0;
                        }else{
                            var checking = 0;
                            var direction = undefined;
                            var looking = true;
                            while(looking){
                                var w = this.ctx.measureText(this.value.substring(0,checking)).width + this.ctx.measureText(this.value.charAt(checking)).width / 2;
                                if(w < xin){
                                    if(direction === false){
                                        looking = false;
                                        continue;
                                    }
                                    direction = true;
                                    checking++;
                                }else{
                                    if(direction === true){
                                        looking = false;
                                        continue;
                                    }
                                    direction = false;
                                    checking--;
                                }
                            }
                            this.insertingAt = checking;
                        }
                        this.highlighting = [this.insertingAt,this.insertingAt];
                        this.ctx.restore();
                    }
                    this.selected = true;
                    this.onselect();
                }
                TextInput.requestingHover = true;
                document.body.style.cursor = "text";
            }else{
                if(TextInput.mouseClicked){
                    if(this.selected){
                        this.selected = false;
                        this.onunselect();
                    }
                }
            }
            if(this.selected && TextInput.mousePressed && TextInput.mouseMoved){
                this.ctx.save();
                this.ctx.font = this.textSize + "px sans-serif";
                var w = this.ctx.measureText(this.value).width;
                var xin = (this.mouseX - this.x - this.textSize * 0.1) + this.scroll;
                if(xin > w){
                    this.highlighting[1] = this.value.length;
                }else if(xin <= this.ctx.measureText(this.value.charAt(0)).width / 2){
                    this.highlighting[1] = 0;
                }else{
                    var checking = 0;
                    var direction = undefined;
                    var looking = true;
                    while(looking){
                        var w = this.ctx.measureText(this.value.substring(0,checking)).width + this.ctx.measureText(this.value.charAt(checking)).width / 2;
                        if(w < xin){
                            if(direction === false){
                                looking = false;
                                continue;
                            }
                            direction = true;
                            checking++;
                        }else{
                            if(direction === true){
                                looking = false;
                                continue;
                            }
                            direction = false;
                            checking--;
                        }
                    }
                    this.highlighting[1] = checking;
                    this.insertingAt = checking;
                    this.arrowKeyHighlightingOrigin = [this.highlighting[0],this.highlighting[1]];
                    this.ctx.restore();
                }
            }
            if(!TextInput.mousePressed && this.highlighting){
                if(this.highlighting[1] < this.highlighting[0]){
                    var save = this.highlighting[0];
                    this.highlighting[0] = this.highlighting[1];
                    this.highlighting[1] = save;
                }
                if(this.highlighting[1] === this.highlighting[0]){
                    this.highlighting = false;
                }
            }
        }
        isMouseInside(){
            return(this.mouseX > this.x && this.mouseX < this.x + this.width && this.mouseY > this.y && this.mouseY < this.y + this.height);
        }
        onselect(){

        }
        onunselect(){

        }
        onkeypress(e){

        }
        onkeyrelease(e){

        }
        onenter(){

        }
        oncopy(){

        }
        onpaste(e){

        }
        setStyle(obj){
            var keys = Object.keys(obj);
            for(var i = 0;i < keys.length;i++){
                if(keys[i] === "onSelect"){
                    var keys2 = Object.keys(obj.onSelect);
                    for(var j = 0;j < keys2.length;j++){
                        this.style.onSelect[keys2[j]] = obj.onSelect[keys2[j]];
                    }
                }else if(typeof this.style[keys[i]] !== "undefined"){
                    this.style[keys[i]] = obj[keys[i]];
                }else{
                    this[keys[i]] = obj[keys[i]];
                }
            }
            return(this);
        }
    }
}
