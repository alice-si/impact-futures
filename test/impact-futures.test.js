var Escrow = artifacts.require("Escrow");
var ImpactFutures = artifacts.require("ImpactFuturesMock");
var ImpactPromise = artifacts.require("ImpactPromise");
var FluidToken = artifacts.require("FluidToken");
var GBP = artifacts.require("DigitalGBPToken");

require("./test-setup");
const { time } = require('openzeppelin-test-helpers');

contract('Impact Futures', function ([owner, validator, funder, investor, unauthorised]) {
  var escrow;
  var gbp;
  var impactFutures;
  var impactCredit;
  var impactPromise;

  before("deploy escrow and token contracts", async function () {
    gbp = await GBP.new();
    let end = await time.latest() + time.duration.years(1);
    impactFutures = await ImpactFutures.new(gbp.address, 10, 100, validator, owner, end);

    impactCredit = await FluidToken.at(await impactFutures.impactCredit());
    (await impactCredit.balanceOf(owner)).should.be.bignumber.equal('1000');
    (await impactCredit.totalSupply()).should.be.bignumber.equal('1000');

    impactPromise = await ImpactPromise.at(await impactFutures.impactPromise());
    (await impactPromise.balanceOf(owner)).should.be.bignumber.equal('0');
    (await impactPromise.totalSupply()).should.be.bignumber.equal('0');

    escrow = await Escrow.at(await impactFutures.escrow());
    (await escrow.capacity()).should.be.bignumber.equal('1000');
    (await gbp.balanceOf(escrow.address)).should.be.bignumber.equal('0');
  });

  it("should get impact credits", async function () {
    await impactCredit.transfer(investor, 100);
    (await impactCredit.balanceOf(investor)).should.be.bignumber.equal('100');
  });

  it("should fund", async function () {
    await gbp.mint(funder, 200);
    await gbp.approve(impactFutures.address, 200, {from: funder});
    await impactFutures.fund(200, {from: funder});

    (await impactPromise.balanceOf(funder)).should.be.bignumber.equal('200');
    (await gbp.balanceOf(escrow.address)).should.be.bignumber.equal('200');
  });


  it("should validate", async function () {
    await impactFutures.validateOutcome({from: validator});

    (await escrow.unlocked()).should.be.bignumber.equal('100');
    (await impactCredit.getAvailableToRedeem({from: investor})).should.be.bignumber.equal('10');
  });


  it("should withdraw from escrow", async function () {
    await impactCredit.redeem(10, {from: investor});

    (await gbp.balanceOf(investor)).should.be.bignumber.equal('10');
    (await impactCredit.getAvailableToRedeem({from: investor})).should.be.bignumber.equal('0');
    (await gbp.balanceOf(escrow.address)).should.be.bignumber.equal('190');
  });

  it("should return remaining funds", async function () {
    await impactFutures.setEnd();
    (await impactFutures.hasEnded()).should.be.true;

    (await impactPromise.balanceOf(funder)).should.be.bignumber.equal('200');
    (await gbp.balanceOf(escrow.address)).should.be.bignumber.equal('190');

    await impactFutures.refund({from: funder});

    (await gbp.balanceOf(escrow.address)).should.be.bignumber.equal('90');
    (await gbp.balanceOf(funder)).should.be.bignumber.equal('100');
    (await impactPromise.balanceOf(funder)).should.be.bignumber.equal('0');
  });

});



